/**
 * End Supports Store
 *
 * Manages parent-child relationships between ends.
 * Many-to-many with max depth of 2 levels (grandparent → parent → leaf).
 */

import { getSupabase, getUserId } from "./base.js";

export interface EndSupportLink {
  parentEndId: string;
  childEndId: string;
  rationale?: string;
}

export interface EndSupportEntry {
  id: string;
  name: string;
  endType: string;
  state: string;
  rationale: string | null;
}

/**
 * Get all parent ends for a given end (ends that this end supports).
 */
export async function getParentEnds(endId: string): Promise<EndSupportEntry[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("end_supports")
    .select(`
      parent_end_id,
      rationale,
      ends!end_supports_parent_end_id_fkey (id, name, end_type, state)
    `)
    .eq("child_end_id", endId);

  if (error) throw new Error(`Failed to get parent ends: ${error.message}`);

  return (data ?? []).map((row) => {
    const end = row.ends as unknown as { id: string; name: string; end_type: string; state: string };
    return {
      id: end.id,
      name: end.name,
      endType: end.end_type,
      state: end.state,
      rationale: row.rationale,
    };
  });
}

/**
 * Get all child ends for a given end (ends that support this end).
 */
export async function getChildEnds(endId: string): Promise<EndSupportEntry[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("end_supports")
    .select(`
      child_end_id,
      rationale,
      ends!end_supports_child_end_id_fkey (id, name, end_type, state)
    `)
    .eq("parent_end_id", endId);

  if (error) throw new Error(`Failed to get child ends: ${error.message}`);

  return (data ?? []).map((row) => {
    const end = row.ends as unknown as { id: string; name: string; end_type: string; state: string };
    return {
      id: end.id,
      name: end.name,
      endType: end.end_type,
      state: end.state,
      rationale: row.rationale,
    };
  });
}

/**
 * Count supporting ends and supported-by ends for a given end.
 */
export async function getSupportCounts(endId: string): Promise<{
  supportingEndCount: number;
  supportsCount: number;
}> {
  const supabase = getSupabase();

  const [{ count: childCount }, { count: parentCount }] = await Promise.all([
    supabase
      .from("end_supports")
      .select("id", { count: "exact", head: true })
      .eq("parent_end_id", endId),
    supabase
      .from("end_supports")
      .select("id", { count: "exact", head: true })
      .eq("child_end_id", endId),
  ]);

  return {
    supportingEndCount: childCount ?? 0,
    supportsCount: parentCount ?? 0,
  };
}

/**
 * Batch-fetch support counts for multiple end IDs.
 */
export async function getSupportCountsBatch(endIds: string[]): Promise<
  Map<string, { supportingEndCount: number; supportsCount: number }>
> {
  if (endIds.length === 0) return new Map();

  const supabase = getSupabase();

  const [{ data: asParent }, { data: asChild }] = await Promise.all([
    supabase
      .from("end_supports")
      .select("parent_end_id")
      .in("parent_end_id", endIds),
    supabase
      .from("end_supports")
      .select("child_end_id")
      .in("child_end_id", endIds),
  ]);

  const childCounts = new Map<string, number>();
  for (const row of asParent ?? []) {
    childCounts.set(row.parent_end_id, (childCounts.get(row.parent_end_id) ?? 0) + 1);
  }

  const parentCounts = new Map<string, number>();
  for (const row of asChild ?? []) {
    parentCounts.set(row.child_end_id, (parentCounts.get(row.child_end_id) ?? 0) + 1);
  }

  const result = new Map<string, { supportingEndCount: number; supportsCount: number }>();
  for (const id of endIds) {
    result.set(id, {
      supportingEndCount: childCounts.get(id) ?? 0,
      supportsCount: parentCounts.get(id) ?? 0,
    });
  }
  return result;
}

/**
 * Validate and create a support link between two ends.
 * Enforces: self-link, depth (max 3 tiers), and cycle detection.
 */
export async function linkSupportingEnd(
  link: EndSupportLink,
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = getSupabase();
  const userId = getUserId();
  const { parentEndId, childEndId, rationale } = link;

  // Self-link check
  if (parentEndId === childEndId) {
    return { success: false, error: "self_link_not_allowed" };
  }

  // Verify ownership — parent must be owned by current user
  const { data: parentEnd, error: parentErr } = await supabase
    .from("ends")
    .select("id")
    .eq("id", parentEndId)
    .eq("user_id", userId)
    .single();

  if (parentErr || !parentEnd) {
    return { success: false, error: "parent_end_not_found_or_not_owned" };
  }

  // Verify child exists (owned by current user)
  const { data: childEnd, error: childErr } = await supabase
    .from("ends")
    .select("id")
    .eq("id", childEndId)
    .eq("user_id", userId)
    .single();

  if (childErr || !childEnd) {
    return { success: false, error: "child_end_not_found_or_not_owned" };
  }

  // Cycle detection first — more specific error than depth.
  // Walk upward from P; if C is an ancestor, the insert would create a cycle.
  if (await isAncestor(childEndId, parentEndId)) {
    return { success: false, error: "link_would_create_cycle" };
  }

  // Depth validation: walk upward from P to count ancestor depth
  const pHasParent = await hasParents(parentEndId);
  const pHasGrandparent = pHasParent ? await hasGrandparents(parentEndId) : false;

  // If P already has a grandparent, adding anything below P exceeds depth 3
  if (pHasGrandparent) {
    return { success: false, error: "link_would_exceed_max_depth" };
  }

  // Depth validation: walk downward from C to check if C has children
  const cHasChildren = await hasChildren(childEndId);

  // If P has a parent AND C has children → depth 4 (P.parent → P → C → C.child)
  if (pHasParent && cHasChildren) {
    return { success: false, error: "link_would_exceed_max_depth" };
  }

  // If C has children, check if those children have children → would make C mid-level
  // with grandchildren, exceeding depth if P is added above
  if (cHasChildren) {
    const cHasGrandchildren = await hasGrandchildren(childEndId);
    if (cHasGrandchildren) {
      return { success: false, error: "link_would_exceed_max_depth" };
    }
  }

  // Insert the link
  const { error: insertError } = await supabase
    .from("end_supports")
    .insert({
      parent_end_id: parentEndId,
      child_end_id: childEndId,
      rationale: rationale ?? null,
    });

  if (insertError) {
    if (insertError.code === "23505") {
      return { success: false, error: "link_already_exists" };
    }
    throw new Error(`Failed to link supporting end: ${insertError.message}`);
  }

  return { success: true };
}

/**
 * Remove a support link between two ends.
 */
export async function unlinkSupportingEnd(
  parentEndId: string,
  childEndId: string,
): Promise<boolean> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from("end_supports")
    .delete()
    .eq("parent_end_id", parentEndId)
    .eq("child_end_id", childEndId);

  if (error) throw new Error(`Failed to unlink supporting end: ${error.message}`);
  return true;
}

// --- Internal helpers ---

async function hasParents(endId: string): Promise<boolean> {
  const supabase = getSupabase();
  const { count } = await supabase
    .from("end_supports")
    .select("id", { count: "exact", head: true })
    .eq("child_end_id", endId);
  return (count ?? 0) > 0;
}

async function hasChildren(endId: string): Promise<boolean> {
  const supabase = getSupabase();
  const { count } = await supabase
    .from("end_supports")
    .select("id", { count: "exact", head: true })
    .eq("parent_end_id", endId);
  return (count ?? 0) > 0;
}

async function hasGrandparents(endId: string): Promise<boolean> {
  const supabase = getSupabase();
  // Get parents of endId, then check if any of them have parents
  const { data: parents } = await supabase
    .from("end_supports")
    .select("parent_end_id")
    .eq("child_end_id", endId);

  if (!parents?.length) return false;

  for (const p of parents) {
    const { count } = await supabase
      .from("end_supports")
      .select("id", { count: "exact", head: true })
      .eq("child_end_id", p.parent_end_id);
    if ((count ?? 0) > 0) return true;
  }
  return false;
}

async function hasGrandchildren(endId: string): Promise<boolean> {
  const supabase = getSupabase();
  // Get children of endId, then check if any of them have children
  const { data: children } = await supabase
    .from("end_supports")
    .select("child_end_id")
    .eq("parent_end_id", endId);

  if (!children?.length) return false;

  for (const c of children) {
    const { count } = await supabase
      .from("end_supports")
      .select("id", { count: "exact", head: true })
      .eq("parent_end_id", c.child_end_id);
    if ((count ?? 0) > 0) return true;
  }
  return false;
}

async function isAncestor(candidateAncestorId: string, startId: string): Promise<boolean> {
  const supabase = getSupabase();
  // Walk upward from startId; if we find candidateAncestorId, it's an ancestor
  const visited = new Set<string>();
  const queue = [startId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const { data: parents } = await supabase
      .from("end_supports")
      .select("parent_end_id")
      .eq("child_end_id", current);

    for (const p of parents ?? []) {
      if (p.parent_end_id === candidateAncestorId) return true;
      queue.push(p.parent_end_id);
    }
  }

  return false;
}
