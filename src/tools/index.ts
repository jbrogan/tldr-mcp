/**
 * MCP Tools - Functions callable by the LLM
 *
 * All tool responses return structured JSON via jsonResponse().
 * The LLM handles presentation; tools are the data layer.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RelationshipType } from "../schemas/person.js";
import { getSupabase, getUserId } from "../store/base.js";
import {
  createPerson,
  deletePerson,
  getPersonById,
  listPersons,
  removeTeamFromAllPersons,
  updatePerson,
} from "../store/persons.js";
import { listAreas, getAreaById } from "../store/areas.js";
import {
  createOrganization,
  deleteOrganization,
  getOrganizationById,
  listOrganizations,
} from "../store/organizations.js";
import {
  createTeam,
  deleteTeam,
  getTeamById,
  listTeams,
  deleteTeamsByOrganizationId,
} from "../store/teams.js";
import {
  createPortfolio,
  deletePortfolio,
  getPortfolioById,
  listPortfolios,
  updatePortfolio,
} from "../store/portfolios.js";
import {
  createEnd,
  deleteEnd,
  getEndById,
  listEnds,
  updateEnd,
  shareEnd,
  unshareEnd,
  listSharedEnds,
  listMyShares,
} from "../store/ends.js";
import {
  createHabit,
  deleteHabit,
  getHabitById,
  listHabits,
  listHabitsWithShared,
  updateHabit,
  updateHabitPersons,
  addHabitPersons,
  removeHabitPersons,
} from "../store/habits.js";
import {
  createAction,
  deleteAction,
  deleteActionsByHabitId,
  listActions,
} from "../store/actions.js";
import {
  createTask,
  deleteTask,
  getTaskById,
  listTasks,
  updateTask,
} from "../store/tasks.js";
import { listUsers } from "../store/users.js";

/**
 * Wrap a data object as an MCP JSON tool response.
 */
function jsonResponse(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
  };
}

function errorResponse(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

async function resolveOwnerName(ownerType: string, ownerId: string): Promise<string> {
  if (ownerType === "organization") {
    const org = await getOrganizationById(ownerId);
    return org?.name ?? ownerId;
  }
  if (ownerType === "team") {
    const team = await getTeamById(ownerId);
    return team?.name ?? ownerId;
  }
  if (ownerType === "person") {
    const person = await getPersonById(ownerId);
    return person ? `${person.firstName} ${person.lastName}` : ownerId;
  }
  return ownerId;
}

export function registerTools(server: McpServer): void {
  // --- Beliefs ---

  server.registerTool(
    "list_beliefs",
    {
      title: "List Beliefs",
      description: "Lists core beliefs with their linked ends.",
      inputSchema: {},
    },
    async () => {
      const { listBeliefs } = await import("../store/beliefs.js");
      const beliefs = await listBeliefs();
      const allEnds = await listEnds();
      return jsonResponse({
        beliefs: beliefs.map((b) => ({
          id: b.id,
          name: b.name,
          description: b.description ?? null,
          linkedEnds: b.endIds.map((eid) => {
            const e = allEnds.find((e) => e.id === eid);
            return e ? { id: e.id, name: e.name } : { id: eid, name: null };
          }),
          createdAt: b.createdAt,
        })),
        count: beliefs.length,
      });
    }
  );

  server.registerTool(
    "get_belief",
    {
      title: "Get Belief",
      description: "Gets a single belief by ID with full details and linked ends.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the belief to fetch"),
      },
    },
    async ({ id }) => {
      const { getBeliefById } = await import("../store/beliefs.js");
      const belief = await getBeliefById(id);
      if (!belief) {
        return errorResponse(`Belief with ID ${id} not found.`);
      }
      const allEnds = await listEnds();
      return jsonResponse({
        belief: {
          id: belief.id,
          name: belief.name,
          description: belief.description ?? null,
          createdAt: belief.createdAt,
          linkedEnds: belief.endIds.map((eid) => {
            const e = allEnds.find((e) => e.id === eid);
            return e ? { id: e.id, name: e.name } : { id: eid, name: null };
          }),
        },
      });
    }
  );

  server.registerTool(
    "update_belief",
    {
      title: "Update Belief",
      description: "Updates a belief's name or description.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the belief to update"),
        name: z.string().optional().describe("New name"),
        description: z.string().optional().describe("New description"),
      },
    },
    async ({ id, name, description }) => {
      const { updateBelief } = await import("../store/beliefs.js");
      const updates: { name?: string; description?: string } = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      const belief = await updateBelief(id, updates);
      if (!belief) {
        return errorResponse(`Belief with ID ${id} not found.`);
      }
      return jsonResponse({
        belief: {
          id: belief.id,
          name: belief.name,
          description: belief.description ?? null,
        },
      });
    }
  );

  server.registerTool(
    "create_belief",
    {
      title: "Create Belief",
      description: "Creates a core belief — a foundational value that motivates ends.",
      inputSchema: {
        name: z.string().min(1).describe("The belief statement"),
        description: z.string().optional().describe("Additional context"),
      },
    },
    async ({ name, description }) => {
      const { createBelief } = await import("../store/beliefs.js");
      const belief = await createBelief({ name, description });
      return jsonResponse({
        belief: {
          id: belief.id,
          name: belief.name,
          description: belief.description ?? null,
          createdAt: belief.createdAt,
        },
      });
    }
  );

  server.registerTool(
    "delete_belief",
    {
      title: "Delete Belief",
      description: "Deletes a belief by ID. Removes all end linkages.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the belief to delete"),
      },
    },
    async ({ id }) => {
      const { deleteBelief } = await import("../store/beliefs.js");
      const belief = await deleteBelief(id);
      if (!belief) {
        return errorResponse(`Belief with ID ${id} not found.`);
      }
      return jsonResponse({ deleted: { id: belief.id, name: belief.name } });
    }
  );

  server.registerTool(
    "link_end_to_belief",
    {
      title: "Link End to Belief",
      description: "Links an end to a belief, indicating the end is motivated by this belief.",
      inputSchema: {
        beliefId: z.string().min(1).describe("ID of the belief"),
        endId: z.string().min(1).describe("ID of the end"),
      },
    },
    async ({ beliefId, endId }) => {
      const { linkEndToBelief } = await import("../store/beliefs.js");
      await linkEndToBelief(beliefId, endId);
      return jsonResponse({ linked: { beliefId, endId } });
    }
  );

  server.registerTool(
    "unlink_end_from_belief",
    {
      title: "Unlink End from Belief",
      description: "Removes the link between an end and a belief.",
      inputSchema: {
        beliefId: z.string().min(1).describe("ID of the belief"),
        endId: z.string().min(1).describe("ID of the end"),
      },
    },
    async ({ beliefId, endId }) => {
      const { unlinkEndFromBelief } = await import("../store/beliefs.js");
      await unlinkEndFromBelief(beliefId, endId);
      return jsonResponse({ unlinked: { beliefId, endId } });
    }
  );

  // --- Areas ---

  server.registerTool(
    "list_areas",
    {
      title: "List Areas",
      description:
        "Lists all Wheel of Life areas (Career, Family, Health, etc.). Areas are seeded on first use.",
      inputSchema: {},
    },
    async () => {
      const areas = await listAreas();
      return jsonResponse({
        areas: areas.map((a) => ({ id: a.id, name: a.name })),
        count: areas.length,
      });
    }
  );

  server.registerTool(
    "create_organization",
    {
      title: "Create Organization",
      description:
        "Creates a new organization - a container for teams and people (e.g., company, church, family).",
      inputSchema: {
        name: z.string().min(1).describe("Organization name"),
      },
    },
    async ({ name }) => {
      const org = await createOrganization({ name });
      return jsonResponse({
        organization: { id: org.id, name: org.name, createdAt: org.createdAt },
      });
    }
  );

  server.registerTool(
    "list_organizations",
    {
      title: "List Organizations",
      description:
        "Lists all organizations. Use expand to show teams and people under each org.",
      inputSchema: {
        expand: z.boolean().optional().describe("If true, show teams and people under each organization"),
      },
    },
    async ({ expand }) => {
      const orgs = await listOrganizations();
      if (!expand) {
        return jsonResponse({
          organizations: orgs.map((o) => ({ id: o.id, name: o.name })),
          count: orgs.length,
        });
      }
      const expanded = await Promise.all(orgs.map(async (org) => {
        const teams = await listTeams(org.id);
        const teamsWithMembers = await Promise.all(teams.map(async (t) => {
          const people = await listPersons({ teamId: t.id });
          return {
            id: t.id,
            name: t.name,
            members: people.map((p) => ({ id: p.id, firstName: p.firstName, lastName: p.lastName })),
          };
        }));
        return { id: org.id, name: org.name, teams: teamsWithMembers };
      }));
      return jsonResponse({ organizations: expanded, count: orgs.length });
    }
  );

  server.registerTool(
    "update_organization",
    {
      title: "Update Organization",
      description: "Updates an organization's name.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the organization to update"),
        name: z.string().optional().describe("New name"),
      },
    },
    async ({ id, name }) => {
      const { updateOrganization } = await import("../store/organizations.js");
      const org = await updateOrganization(id, { name });
      if (!org) {
        return errorResponse(`Organization with ID ${id} not found.`);
      }
      return jsonResponse({ organization: { id: org.id, name: org.name } });
    }
  );

  server.registerTool(
    "delete_organization",
    {
      title: "Delete Organization",
      description:
        "Deletes an organization by ID. Removes the organization from all persons' memberships.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the organization to delete"),
      },
    },
    async ({ id }) => {
      const org = await getOrganizationById(id);
      if (!org) {
        return errorResponse(`Organization with ID ${id} not found.`);
      }
      const teams = await listTeams(id);
      for (const t of teams) {
        await removeTeamFromAllPersons(t.id);
      }
      await deleteTeamsByOrganizationId(id);
      await deleteOrganization(id);
      return jsonResponse({ deleted: { id: org.id, name: org.name } });
    }
  );

  server.registerTool(
    "create_team",
    {
      title: "Create Team",
      description:
        "Creates a new team within an organization. Teams are sub-groups (e.g., Engineering, Leadership, Kids) that people can belong to.",
      inputSchema: {
        name: z.string().min(1).describe("Team name"),
        organizationId: z.string().min(1).describe("ID of the organization this team belongs to"),
      },
    },
    async ({ name, organizationId }) => {
      const team = await createTeam({ name, organizationId });
      return jsonResponse({
        team: { id: team.id, name: team.name, organizationId: team.organizationId, createdAt: team.createdAt },
      });
    }
  );

  server.registerTool(
    "list_teams",
    {
      title: "List Teams",
      description:
        "Lists teams. For 'list teams for [person]', 'what teams is X in?', 'teams for Alex' - use personId with that person's ID (from list_people). For 'my teams' use personId: __self__. For 'teams in Acme' use organizationId. Do NOT use organizationId when listing a specific person's teams.",
      inputSchema: {
        organizationId: z.string().optional().describe("Filter by organization ID (only when listing all teams in an org, NOT for person-specific queries)"),
        personId: z.string().optional().describe("Filter to teams this person belongs to. REQUIRED for 'list teams for [person]' - use person's ID from list_people. Use __self__ for current user."),
      },
    },
    async ({ organizationId, personId }) => {
      let teams = await listTeams(personId ? undefined : organizationId);
      if (personId) {
        const person = await getPersonById(personId);
        if (!person) {
          return errorResponse(`Person with ID ${personId} not found.`);
        }
        const memberTeamIds = new Set(person.teamIds ?? []);
        teams = teams.filter((t) => memberTeamIds.has(t.id));
      }
      const teamObjs = await Promise.all(teams.map(async (t) => {
        const org = await getOrganizationById(t.organizationId);
        return {
          id: t.id,
          name: t.name,
          organization: org ? { id: org.id, name: org.name } : { id: t.organizationId, name: null },
        };
      }));
      return jsonResponse({ teams: teamObjs, count: teams.length });
    }
  );

  server.registerTool(
    "get_team",
    {
      title: "Get Team",
      description:
        "Gets a single team by ID with full details: organization, members, and their roles.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the team to fetch"),
      },
    },
    async ({ id }) => {
      const team = await getTeamById(id);
      if (!team) {
        return errorResponse(`Team with ID ${id} not found.`);
      }
      const org = await getOrganizationById(team.organizationId);
      const members = await listPersons({ teamId: id });
      return jsonResponse({
        team: {
          id: team.id,
          name: team.name,
          organization: org ? { id: org.id, name: org.name } : { id: team.organizationId, name: null },
          createdAt: team.createdAt,
          members: members.map((p) => ({
            id: p.id,
            firstName: p.firstName,
            lastName: p.lastName,
            relationshipType: p.relationshipType ?? null,
            linkedAccount: !!p.userId,
          })),
        },
      });
    }
  );

  server.registerTool(
    "update_team",
    {
      title: "Update Team",
      description: "Updates a team's name.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the team to update"),
        name: z.string().optional().describe("New team name"),
      },
    },
    async ({ id, name }) => {
      const { updateTeam } = await import("../store/teams.js");
      const team = await updateTeam(id, { name });
      if (!team) {
        return errorResponse(`Team with ID ${id} not found.`);
      }
      return jsonResponse({ team: { id: team.id, name: team.name } });
    }
  );

  server.registerTool(
    "delete_team",
    {
      title: "Delete Team",
      description:
        "Deletes a team by ID. Removes the team from all persons' memberships.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the team to delete"),
      },
    },
    async ({ id }) => {
      const team = await getTeamById(id);
      if (!team) {
        return errorResponse(`Team with ID ${id} not found.`);
      }
      await removeTeamFromAllPersons(id);
      await deleteTeam(id);
      return jsonResponse({ deleted: { id: team.id, name: team.name } });
    }
  );

  server.registerTool(
    "create_portfolio",
    {
      title: "Create Portfolio",
      description:
        "Creates a portfolio - a grouping of ends under an org, team, or person. Enables the view: (org/team/person) -> portfolio -> ends -> habits.",
      inputSchema: {
        name: z.string().min(1).describe("Portfolio name"),
        ownerType: z
          .enum(["organization", "team", "person"])
          .describe("Type of owner (org, team, or person)"),
        ownerId: z.string().min(1).describe("ID of the organization, team, or person"),
        portfolioType: z
          .enum(["goals", "projects", "quarterly", "backlog", "operations", "other"])
          .optional()
          .describe("Type of portfolio (goals, projects, quarterly, backlog, other)"),
        description: z.string().optional().describe("Optional description"),
      },
    },
    async ({ name, ownerType, ownerId, portfolioType, description }) => {
      const portfolio = await createPortfolio({
        name,
        ownerType,
        ownerId,
        portfolioType,
        description,
      });
      return jsonResponse({
        portfolio: {
          id: portfolio.id,
          name: portfolio.name,
          ownerType: portfolio.ownerType,
          ownerId: portfolio.ownerId,
          portfolioType: portfolio.portfolioType ?? null,
          description: portfolio.description ?? null,
          createdAt: portfolio.createdAt,
        },
      });
    }
  );

  server.registerTool(
    "list_portfolios",
    {
      title: "List Portfolios",
      description:
        "Lists portfolios. Filter by owner (ownerType + ownerId) or by portfolioType.",
      inputSchema: {
        ownerType: z
          .enum(["organization", "team", "person"])
          .optional()
          .describe("Filter by owner type"),
        ownerId: z.string().optional().describe("Filter by owner ID"),
        portfolioType: z
          .enum(["goals", "projects", "quarterly", "backlog", "operations", "other"])
          .optional()
          .describe("Filter by portfolio type"),
      },
    },
    async ({ ownerType, ownerId, portfolioType }) => {
      const portfolios = await listPortfolios(
        ownerType || ownerId || portfolioType
          ? { ownerType, ownerId, portfolioType }
          : undefined
      );
      const portfolioObjs = await Promise.all(portfolios.map(async (c) => {
        const ownerName = await resolveOwnerName(c.ownerType, c.ownerId);
        return {
          id: c.id,
          name: c.name,
          ownerType: c.ownerType,
          owner: { id: c.ownerId, name: ownerName },
          portfolioType: c.portfolioType ?? null,
        };
      }));
      return jsonResponse({ portfolios: portfolioObjs, count: portfolios.length });
    }
  );

  server.registerTool(
    "get_portfolio",
    {
      title: "Get Portfolio",
      description:
        "Gets a single portfolio by ID with full details: owner, type, and the ends it contains.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the portfolio to fetch"),
      },
    },
    async ({ id }) => {
      const portfolio = await getPortfolioById(id);
      if (!portfolio) {
        return errorResponse(`Portfolio with ID ${id} not found.`);
      }
      const ownerName = await resolveOwnerName(portfolio.ownerType, portfolio.ownerId);
      const allEnds = await listEnds();
      const ends = allEnds.filter((e) => e.portfolioId === id);
      return jsonResponse({
        portfolio: {
          id: portfolio.id,
          name: portfolio.name,
          ownerType: portfolio.ownerType,
          owner: { id: portfolio.ownerId, name: ownerName },
          portfolioType: portfolio.portfolioType ?? null,
          description: portfolio.description ?? null,
          createdAt: portfolio.createdAt,
          ends: ends.map((e) => ({ id: e.id, name: e.name })),
        },
      });
    }
  );

  server.registerTool(
    "update_portfolio",
    {
      title: "Update Portfolio",
      description: "Updates a portfolio by ID. Only provided fields are updated.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the portfolio to update"),
        name: z.string().min(1).optional().describe("Portfolio name"),
        portfolioType: z
          .enum(["goals", "projects", "quarterly", "backlog", "operations", "other"])
          .optional()
          .describe("Portfolio type"),
        description: z.string().optional().describe("Description"),
      },
    },
    async ({ id, name, portfolioType, description }) => {
      const existing = await getPortfolioById(id);
      if (!existing) {
        return errorResponse(`Portfolio with ID ${id} not found.`);
      }
      const updates: Record<string, unknown> = {};
      if (name != null) updates.name = name;
      if (portfolioType !== undefined) updates.portfolioType = portfolioType;
      if (description !== undefined) updates.description = description;
      const portfolio = await updatePortfolio(id, updates);
      return jsonResponse({
        portfolio: {
          id,
          name: portfolio?.name ?? null,
          portfolioType: portfolio?.portfolioType ?? null,
          description: portfolio?.description ?? null,
        },
      });
    }
  );

  server.registerTool(
    "delete_portfolio",
    {
      title: "Delete Portfolio",
      description:
        "Deletes a portfolio by ID. Ends in the portfolio are not deleted; their portfolioId is not automatically cleared.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the portfolio to delete"),
      },
    },
    async ({ id }) => {
      const portfolio = await getPortfolioById(id);
      if (!portfolio) {
        return errorResponse(`Portfolio with ID ${id} not found.`);
      }
      await deletePortfolio(id);
      return jsonResponse({ deleted: { id, name: portfolio.name } });
    }
  );

  server.registerTool(
    "create_end",
    {
      title: "Create End",
      description:
        "Creates an end. Three types: journey (ongoing aspiration, e.g. 'Be a great father'), destination (bounded goal, e.g. 'Launch product'), inquiry (hypothesis, e.g. 'Is this viable?'). Use `purpose` to capture why the end exists. Optionally link as a supporting end of a parent in the same call.",
      inputSchema: {
        name: z.string().min(1).describe("Name of the end"),
        areaId: z.string().optional().describe("Area this end belongs to"),
        portfolioId: z.string().optional().describe("Portfolio this end belongs to"),
        endType: z.enum(["journey", "destination", "inquiry"]).optional().describe("Type: journey (default) | destination | inquiry"),
        dueDate: z.string().optional().describe("Target date (YYYY-MM-DD). Most relevant for destination/inquiry."),
        thesis: z.string().optional().describe("Inquiry thesis - what is being investigated? (inquiry only)"),
        purpose: z.string().optional().describe("Why this end exists — keep to a sentence or two"),
        parentEndId: z.string().optional().describe("If provided, link this new end as a supporting end of the given parent. Rolled back if link validation fails."),
        supportRationale: z.string().optional().describe("Rationale for the support link (only used with parentEndId)."),
      },
    },
    async ({ name, areaId, portfolioId, endType, dueDate, thesis, purpose, parentEndId, supportRationale }) => {
      const end = await createEnd({ name, areaId, portfolioId, endType: endType ?? "journey", dueDate, thesis, purpose });

      let linkResult: { parentEndId: string; childEndId: string; rationale: string | null } | null = null;
      let linkError: string | null = null;

      if (parentEndId) {
        const { linkSupportingEnd } = await import("../store/endSupports.js");
        const result = await linkSupportingEnd({
          parentEndId,
          childEndId: end.id,
          rationale: supportRationale,
        });
        if (result.success) {
          linkResult = { parentEndId, childEndId: end.id, rationale: supportRationale ?? null };
        } else {
          // Rollback: delete the created end
          await deleteEnd(end.id);
          return errorResponse(`End created but link failed: ${result.error}. Creation rolled back.`);
        }
      }

      return jsonResponse({
        end: {
          id: end.id,
          name: end.name,
          endType: end.endType,
          state: end.state,
          areaId: end.areaId ?? null,
          portfolioId: end.portfolioId ?? null,
          dueDate: end.dueDate ?? null,
          thesis: end.thesis ?? null,
          purpose: end.purpose ?? null,
          createdAt: end.createdAt,
        },
        linked: linkResult,
      });
    }
  );

  server.registerTool(
    "list_ends",
    {
      title: "List Ends",
      description: "Lists ends with habits, open tasks, and hierarchy. The single authoritative tool for ends overview — includes habits, open tasks, supporting ends, and parent ends for each end.",
      inputSchema: {
        areaId: z.string().optional().describe("Filter by area ID"),
        portfolioId: z.string().optional().describe("Filter by portfolio ID"),
        endType: z.enum(["journey", "destination", "inquiry"]).optional().describe("Filter by type"),
        state: z.enum(["active", "paused", "archived", "completed", "abandoned", "resolved"]).optional().describe("Filter by state"),
      },
    },
    async ({ areaId, portfolioId, endType, state }) => {
      const hasFilter = areaId || portfolioId || endType || state;
      const ends = await listEnds(hasFilter ? { areaId, portfolioId, endType, state } : undefined);
      const endIds = ends.map((e) => e.id);

      // Bulk preload all related data
      const supabase = getSupabase();
      const userId = getUserId();
      const [allAreas, allPortfolios, allHabits, { data: openTaskRows }] = await Promise.all([
        listAreas(),
        listPortfolios(),
        listHabits(),
        supabase
          .from("tasks")
          .select("id, name, end_id, due_date, scheduled_date, estimated_duration_minutes, recurrence")
          .eq("user_id", userId)
          .is("completed_at", null)
          .not("end_id", "is", null),
      ]);
      const openTasks = (openTaskRows ?? []).map((t: any) => ({
        id: t.id, name: t.name, endId: t.end_id,
        dueDate: t.due_date, scheduledDate: t.scheduled_date,
        estimatedDurationMinutes: t.estimated_duration_minutes,
        recurrence: t.recurrence,
      }));
      const allEndsMap = new Map(ends.map((e) => [e.id, e]));

      // Fetch all end_supports rows in bulk (2 queries)
      const [{ data: childRows }, { data: parentRows }] = await Promise.all([
        supabase
          .from("end_supports")
          .select("parent_end_id, child_end_id, rationale, ends!end_supports_child_end_id_fkey (id, name, end_type, state)")
          .in("parent_end_id", endIds.length > 0 ? endIds : [""]),
        supabase
          .from("end_supports")
          .select("parent_end_id, child_end_id, rationale, ends!end_supports_parent_end_id_fkey (id, name, end_type, state)")
          .in("child_end_id", endIds.length > 0 ? endIds : [""]),
      ]);

      // Build maps: endId → children, endId → parents
      const childrenMap = new Map<string, Array<{ id: string; name: string; endType: string; state: string; rationale: string | null }>>();
      for (const row of childRows ?? []) {
        const child = row.ends as unknown as { id: string; name: string; end_type: string; state: string } | null;
        if (!child) continue;
        const list = childrenMap.get(row.parent_end_id) ?? [];
        list.push({ id: child.id, name: child.name, endType: child.end_type, state: child.state, rationale: row.rationale });
        childrenMap.set(row.parent_end_id, list);
      }

      const parentsMap = new Map<string, Array<{ id: string; name: string; endType: string; state: string; rationale: string | null }>>();
      for (const row of parentRows ?? []) {
        const parent = row.ends as unknown as { id: string; name: string; end_type: string; state: string } | null;
        if (!parent) continue;
        const list = parentsMap.get(row.child_end_id) ?? [];
        list.push({ id: parent.id, name: parent.name, endType: parent.end_type, state: parent.state, rationale: row.rationale });
        parentsMap.set(row.child_end_id, list);
      }

      return jsonResponse({
        ends: ends.map((e) => {
          const area = e.areaId ? allAreas.find((a) => a.id === e.areaId) : undefined;
          const portfolio = e.portfolioId ? allPortfolios.find((c) => c.id === e.portfolioId) : undefined;
          const habits = allHabits.filter((h) => h.endId === e.id);
          const tasks = openTasks.filter((t: any) => t.endId === e.id);
          return {
            id: e.id,
            name: e.name,
            endType: e.endType,
            state: e.state,
            dueDate: e.dueDate ?? null,
            purpose: e.purpose ?? null,
            area: area ? { id: area.id, name: area.name } : null,
            portfolio: portfolio ? { id: portfolio.id, name: portfolio.name } : null,
            habits: habits.map((h) => ({
              id: h.id,
              name: h.name,
              recurrence: h.recurrence ?? null,
              durationMinutes: h.durationMinutes ?? null,
            })),
            openTasks: tasks.map((t) => ({
              id: t.id,
              name: t.name,
              dueDate: t.dueDate ?? null,
              scheduledDate: t.scheduledDate ?? null,
              estimatedDurationMinutes: t.estimatedDurationMinutes ?? null,
              recurrence: t.recurrence ?? null,
            })),
            supportingEnds: childrenMap.get(e.id) ?? [],
            supports: parentsMap.get(e.id) ?? [],
          };
        }),
        count: ends.length,
      });
    }
  );

  server.registerTool(
    "get_end",
    {
      title: "Get End",
      description:
        "Gets a single end by ID with full details: area, portfolio, habits (with participants), and sharing info.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the end to fetch"),
      },
    },
    async ({ id }) => {
      const end = await getEndById(id);
      if (!end) {
        return errorResponse(`End with ID ${id} not found.`);
      }
      const area = end.areaId ? await getAreaById(end.areaId) : undefined;
      const portfolios = await listPortfolios();
      const portfolio = end.portfolioId ? portfolios.find((c) => c.id === end.portfolioId) : undefined;
      const allHabits = await listHabitsWithShared({ endId: id });
      const myHabits = allHabits.filter((h) => !h.isShared);
      const sharedHabits = allHabits.filter((h) => h.isShared);

      async function formatHabitObj(h: typeof allHabits[0]) {
        const participants: { id: string; firstName: string; lastName: string }[] = [];
        const personNames: string[] = [];
        for (const pid of h.personIds ?? []) {
          const person = await getPersonById(pid);
          if (person) {
            participants.push({ id: person.id, firstName: person.firstName, lastName: person.lastName ?? "" });
            personNames.push(`${person.firstName} ${person.lastName ?? ""}`);
          } else {
            participants.push({ id: pid, firstName: pid, lastName: "" });
            personNames.push(pid);
          }
        }
        let sharedBy: string | null = null;
        if (h.isShared && h.ownerId) {
          const { data: ownerPerson } = await getSupabase()
            .from("persons")
            .select("first_name, last_name")
            .eq("linked_user_id", h.ownerId)
            .eq("relationship_type", "self")
            .single();
          const ownerName = ownerPerson ? `${ownerPerson.first_name} ${ownerPerson.last_name}` : h.ownerDisplayName ?? "unknown";
          if (!personNames.includes(ownerName)) {
            sharedBy = ownerName;
          }
        }
        return {
          id: h.id,
          name: h.name,
          recurrence: h.recurrence ?? null,
          participants,
          isShared: h.isShared ?? false,
          sharedBy,
        };
      }

      const myHabitObjs = await Promise.all(myHabits.map(formatHabitObj));
      const sharedHabitObjs = await Promise.all(sharedHabits.map(formatHabitObj));
      const { listBeliefs } = await import("../store/beliefs.js");
      const allBeliefs = await listBeliefs();
      const linkedBeliefs = allBeliefs.filter((b) => b.endIds.includes(id));

      // Contextual sharing info
      const shares = await listMyShares();
      const endShares = shares.filter((s) => s.endId === id);
      const isOwner = endShares.length > 0;
      let sharing: { type: "owner"; sharedWith: { userId: string; name: string | null; email: string }[] } | { type: "shared"; sharedBy: string } | null = null;

      if (isOwner) {
        const sharedWith = await Promise.all(endShares.map(async (s) => {
          const { data: person } = await getSupabase()
            .from("persons")
            .select("first_name, last_name")
            .eq("linked_user_id", s.sharedWithUserId)
            .eq("relationship_type", "self")
            .single();
          return {
            userId: s.sharedWithUserId,
            name: person ? `${person.first_name} ${person.last_name}` : null,
            email: s.sharedWithEmail,
          };
        }));
        if (sharedWith.length > 0) {
          sharing = { type: "owner", sharedWith };
        }
      } else {
        const sharedEnds = await listSharedEnds();
        const sharedEnd = sharedEnds.find((e) => e.id === id);
        if (sharedEnd?.ownerDisplayName) {
          sharing = { type: "shared", sharedBy: sharedEnd.ownerDisplayName };
        }
      }
      const { listTasksForEnd } = await import("../store/tasks.js");
      const tasks = await listTasksForEnd(id, { completed: false });
      const isSharedEnd = sharing !== null;

      return jsonResponse({
        end: {
          id: end.id,
          name: end.name,
          endType: end.endType,
          state: end.state,
          area: area ? { id: area.id, name: area.name } : null,
          portfolio: portfolio ? { id: portfolio.id, name: portfolio.name } : null,
          dueDate: end.dueDate ?? null,
          thesis: end.thesis ?? null,
          resolutionNotes: end.resolutionNotes ?? null,
          purpose: end.purpose ?? null,
          createdAt: end.createdAt,
          beliefs: linkedBeliefs.map((b) => ({ id: b.id, name: b.name })),
          habits: myHabitObjs,
          sharedHabits: sharedHabitObjs,
          openTasks: tasks.map((t) => ({
            id: t.id,
            name: t.name,
            dueDate: t.dueDate ?? null,
            ownerDisplayName: isSharedEnd ? (t.ownerDisplayName ?? null) : null,
          })),
          sharing,
          supportingEnds: await (async () => {
            const { getChildEnds } = await import("../store/endSupports.js");
            return getChildEnds(id);
          })(),
          supports: await (async () => {
            const { getParentEnds } = await import("../store/endSupports.js");
            return getParentEnds(id);
          })(),
        },
      });
    }
  );

  server.registerTool(
    "update_end",
    {
      title: "Update End",
      description:
        "Updates an end by ID. Use to rename, change area/portfolio, set due date, transition state (e.g. active → completed), or add thesis/resolution notes for inquiry ends. State transitions are validated per end type.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the end to update"),
        name: z.string().min(1).optional().describe("End name"),
        areaId: z.string().optional().describe("Area this end belongs to"),
        portfolioId: z.string().optional().describe("Portfolio this end belongs to"),
        endType: z.enum(["journey", "destination", "inquiry"]).optional().describe("Change type. Resets state to active if current state is invalid for new type."),
        state: z.enum(["active", "paused", "archived", "completed", "abandoned", "resolved"]).optional().describe("Transition to this state"),
        dueDate: z.string().optional().describe("Target date (YYYY-MM-DD)"),
        thesis: z.string().optional().describe("Inquiry thesis (inquiry ends only)"),
        resolutionNotes: z.string().optional().describe("Resolution notes (inquiry ends only, when resolving)"),
        purpose: z.string().optional().describe("Why this end exists — keep to a sentence or two"),
      },
    },
    async ({ id, name, areaId, portfolioId, endType, state, dueDate, thesis, resolutionNotes, purpose }) => {
      const updates: Record<string, unknown> = {};
      if (name != null) updates.name = name;
      if (areaId !== undefined) updates.areaId = areaId;
      if (portfolioId !== undefined) updates.portfolioId = portfolioId;
      if (endType !== undefined) updates.endType = endType;
      if (state !== undefined) updates.state = state;
      if (dueDate !== undefined) updates.dueDate = dueDate;
      if (thesis !== undefined) updates.thesis = thesis;
      if (resolutionNotes !== undefined) updates.resolutionNotes = resolutionNotes;
      if (purpose !== undefined) updates.purpose = purpose;
      try {
        const end = await updateEnd(id, updates as Parameters<typeof updateEnd>[1]);
        if (!end) {
          return errorResponse(`End with ID ${id} not found.`);
        }
        return jsonResponse({
          end: {
            id: end.id,
            name: end.name,
            endType: end.endType,
            state: end.state,
            areaId: end.areaId ?? null,
            portfolioId: end.portfolioId ?? null,
            dueDate: end.dueDate ?? null,
            thesis: end.thesis ?? null,
            resolutionNotes: end.resolutionNotes ?? null,
            purpose: end.purpose ?? null,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Update failed";
        return errorResponse(message);
      }
    }
  );

  server.registerTool(
    "delete_end",
    {
      title: "Delete End",
      description: "Deletes an end by ID.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the end to delete"),
      },
    },
    async ({ id }) => {
      const deleted = await deleteEnd(id);
      if (!deleted) {
        return errorResponse(`End with ID ${id} not found.`);
      }
      return jsonResponse({ deleted: { id: deleted.id, name: deleted.name } });
    }
  );

  // ============================================================================
  // SUPPORTING ENDS TOOLS
  // ============================================================================

  server.registerTool(
    "link_supporting_end",
    {
      title: "Link Supporting End",
      description:
        "Links a child end as supporting a parent end. Max depth: grandparent → parent → leaf (3 tiers). Validates depth, cycles, and ownership.",
      inputSchema: {
        parentEndId: z.string().min(1).describe("ID of the higher-level end being supported"),
        childEndId: z.string().min(1).describe("ID of the supporting end"),
        rationale: z.string().optional().describe("Why this link exists (e.g. 'spawned from inquiry resolution', 'milestone toward parent')"),
      },
    },
    async ({ parentEndId, childEndId, rationale }) => {
      const { linkSupportingEnd } = await import("../store/endSupports.js");
      const result = await linkSupportingEnd({ parentEndId, childEndId, rationale });
      if (!result.success) {
        return errorResponse(result.error);
      }
      return jsonResponse({ linked: { parentEndId, childEndId, rationale: rationale ?? null } });
    }
  );

  server.registerTool(
    "unlink_supporting_end",
    {
      title: "Unlink Supporting End",
      description: "Removes the support link between a parent and child end.",
      inputSchema: {
        parentEndId: z.string().min(1).describe("ID of the parent end"),
        childEndId: z.string().min(1).describe("ID of the child end"),
      },
    },
    async ({ parentEndId, childEndId }) => {
      const { unlinkSupportingEnd } = await import("../store/endSupports.js");
      await unlinkSupportingEnd(parentEndId, childEndId);
      return jsonResponse({ unlinked: { parentEndId, childEndId } });
    }
  );

  server.registerTool(
    "create_habit",
    {
      title: "Create Habit",
      description:
        "Creates a habit - a recurring behavior that serves ends. Generates actions that can be tracked.",
      inputSchema: {
        name: z.string().min(1).describe("Name of the habit"),
        endId: z.string().min(1).describe("End this habit serves"),
        areaId: z.string().optional(),
        teamId: z.string().optional(),
        personIds: z.array(z.string()).optional().describe("IDs of people who participate in the habit"),
        recurrence: z.string().optional().describe("e.g. daily, weekly, 3x/week"),
        durationMinutes: z.number().int().positive().optional().describe("Estimated time in minutes"),
      },
    },
    async ({ name, endId, areaId, teamId, personIds, recurrence, durationMinutes }) => {
      const habit = await createHabit({
        name,
        endId,
        areaId,
        teamId,
        personIds,
        recurrence,
        durationMinutes,
      });
      const end = await getEndById(habit.endId);
      return jsonResponse({
        habit: {
          id: habit.id,
          name: habit.name,
          end: end ? { id: end.id, name: end.name } : { id: habit.endId, name: null },
          areaId: habit.areaId ?? null,
          teamId: habit.teamId ?? null,
          personIds: habit.personIds ?? [],
          recurrence: habit.recurrence ?? null,
          durationMinutes: habit.durationMinutes ?? null,
          createdAt: habit.createdAt,
        },
      });
    }
  );

  server.registerTool(
    "list_habits",
    {
      title: "List Habits",
      description:
        "Lists habits. Optionally filter by end, area, organization, or person.",
      inputSchema: {
        endId: z.string().optional().describe("Filter by end ID"),
        areaId: z.string().optional().describe("Filter by area ID"),
        teamId: z.string().optional().describe("Filter by team ID"),
        personId: z.string().optional().describe("Filter by person who performs the habit"),
      },
    },
    async ({ endId, areaId, teamId, personId }) => {
      let habits = await listHabits({
        endId,
        areaId,
        teamId,
        personId,
      });

      // Also include habits linked to ends in this area
      if (areaId && !endId) {
        const allEnds = await listEnds();
        const endIdsInArea = new Set(allEnds.filter((e) => e.areaId === areaId).map((e) => e.id));
        const allHabits = await listHabits({ personId });
        const habitIds = new Set(habits.map((h) => h.id));
        for (const h of allHabits) {
          if (!habitIds.has(h.id) && h.endId && endIdsInArea.has(h.endId)) {
            habits.push(h);
            habitIds.add(h.id);
          }
        }
      }

      const allEnds = await listEnds({ includeShared: true });
      const allAreas = await listAreas();
      const habitObjs = await Promise.all(habits.map(async (h) => {
        const e = h.endId ? allEnds.find((e) => e.id === h.endId) : undefined;
        const end = e ? { id: e.id, name: e.name } : h.endId ? { id: h.endId, name: null } : null;
        const area = h.areaId ? allAreas.find((a) => a.id === h.areaId) : undefined;
        const team = h.teamId ? await getTeamById(h.teamId) : undefined;
        return {
          id: h.id,
          name: h.name,
          end,
          recurrence: h.recurrence ?? null,
          durationMinutes: h.durationMinutes ?? null,
          area: area ? { id: area.id, name: area.name } : h.areaId ? { id: h.areaId, name: null } : null,
          team: team ? { id: team.id, name: team.name } : h.teamId ? { id: h.teamId, name: null } : null,
        };
      }));
      return jsonResponse({ habits: habitObjs, count: habits.length });
    }
  );

  server.registerTool(
    "get_habit",
    {
      title: "Get Habit",
      description:
        "Gets a single habit by ID with full details: ends, area, team, participants, recurrence, and recent actions.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the habit to fetch"),
      },
    },
    async ({ id }) => {
      const habit = await getHabitById(id);
      if (!habit) {
        return errorResponse(`Habit with ID ${id} not found.`);
      }
      const allEnds = await listEnds({ includeShared: true });
      const e = habit.endId ? allEnds.find((e) => e.id === habit.endId) : undefined;
      const end = e ? { id: e.id, name: e.name } : habit.endId ? { id: habit.endId, name: null } : null;
      const participants: { id: string; firstName: string; lastName: string }[] = [];
      for (const pid of habit.personIds ?? []) {
        const person = await getPersonById(pid);
        participants.push(person ? { id: person.id, firstName: person.firstName, lastName: person.lastName ?? "" } : { id: pid, firstName: pid, lastName: "" });
      }
      const area = habit.areaId ? await getAreaById(habit.areaId) : undefined;
      const team = habit.teamId ? await getTeamById(habit.teamId) : undefined;
      const { listActionsWithShared } = await import("../store/actions.js");
      const actions = await listActionsWithShared({ habitId: id });
      const recentActions = actions.slice(0, 5);

      return jsonResponse({
        habit: {
          id: habit.id,
          name: habit.name,
          end,
          area: area ? { id: area.id, name: area.name } : null,
          team: team ? { id: team.id, name: team.name } : null,
          participants,
          recurrence: habit.recurrence ?? null,
          durationMinutes: habit.durationMinutes ?? null,
          createdAt: habit.createdAt,
          recentActions: recentActions.map((a) => ({
            id: a.id,
            completedAt: a.completedAt,
            actualDurationMinutes: a.actualDurationMinutes ?? null,
            isShared: a.isShared ?? false,
            ownerDisplayName: (a.isShared && a.ownerDisplayName) ? a.ownerDisplayName : null,
          })),
        },
      });
    }
  );

  server.registerTool(
    "update_habit",
    {
      title: "Update Habit",
      description:
        "Updates a habit's name, recurrence, duration, end, or participants.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the habit to update"),
        name: z.string().optional().describe("New name"),
        endId: z.string().optional().describe("Change the end this habit serves"),
        recurrence: z.string().optional().describe("New recurrence (daily, weekly, monthly, etc.)"),
        durationMinutes: z.number().optional().describe("New expected duration in minutes"),
        personIdsToAdd: z.array(z.string()).optional().describe("Person IDs to add as participants"),
        personIdsToRemove: z.array(z.string()).optional().describe("Person IDs to remove as participants"),
      },
    },
    async ({ id, name, endId, recurrence, durationMinutes, personIdsToAdd, personIdsToRemove }) => {
      const existing = await getHabitById(id);
      if (!existing) {
        return errorResponse(`Habit with ID ${id} not found.`);
      }
      const changes: string[] = [];
      const fieldUpdates: { name?: string; endId?: string; recurrence?: string; durationMinutes?: number } = {};
      if (name != null) fieldUpdates.name = name;
      if (endId != null) fieldUpdates.endId = endId;
      if (recurrence != null) fieldUpdates.recurrence = recurrence;
      if (durationMinutes != null) fieldUpdates.durationMinutes = durationMinutes;
      if (Object.keys(fieldUpdates).length > 0) {
        await updateHabit(id, fieldUpdates);
        if (name) changes.push(`renamed`);
        if (endId) changes.push(`changedEnd`);
        if (recurrence) changes.push(`recurrence`);
        if (durationMinutes != null) changes.push(`duration`);
      }
      if (personIdsToAdd?.length) {
        await addHabitPersons(id, personIdsToAdd);
        changes.push(`addedParticipants`);
      }
      if (personIdsToRemove?.length) {
        await removeHabitPersons(id, personIdsToRemove);
        changes.push(`removedParticipants`);
      }
      const habit = await getHabitById(id);
      const end = habit?.endId ? await getEndById(habit.endId) : undefined;
      return jsonResponse({
        habit: {
          id,
          name: habit?.name ?? null,
          end: end ? { id: end.id, name: end.name } : habit?.endId ? { id: habit.endId, name: null } : null,
          personIds: habit?.personIds ?? [],
          recurrence: habit?.recurrence ?? null,
          durationMinutes: habit?.durationMinutes ?? null,
          changes,
        },
      });
    }
  );

  server.registerTool(
    "delete_habit",
    {
      title: "Delete Habit",
      description:
        "Deletes a habit by ID. Also deletes all tracked actions for this habit.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the habit to delete"),
      },
    },
    async ({ id }) => {
      const habit = await getHabitById(id);
      if (!habit) {
        return errorResponse(`Habit with ID ${id} not found.`);
      }
      const actionsDeleted = await deleteActionsByHabitId(id);
      await deleteHabit(id);
      return jsonResponse({ deleted: { id: habit.id, name: habit.name, actionsDeleted } });
    }
  );

  server.registerTool(
    "create_action",
    {
      title: "Create Action",
      description:
        "Records a completed habit action (e.g., practiced guitar on Feb 24). Use withPersonIds for shared experience, forPersonIds for acts of service.",
      inputSchema: {
        habitId: z.string().min(1).describe("ID of the habit"),
        completedAt: z.string().describe("When completed: 'today' | 'yesterday' | YYYY-MM-DD | full ISO timestamp"),
        actualDurationMinutes: z.number().int().positive().optional().describe("Actual time spent in minutes"),
        notes: z.string().optional(),
        withPersonIds: z.array(z.string()).optional().describe("Person IDs - did it with (shared experience)"),
        forPersonIds: z.array(z.string()).optional().describe("Person IDs - did it for (acts of service)"),
      },
    },
    async ({ habitId, completedAt, actualDurationMinutes, notes, withPersonIds, forPersonIds }) => {
      const { getUserTimezone, resolveCompletedAt } = await import("../utils/timezone.js");
      const tz = await getUserTimezone();
      const completedAtISO = resolveCompletedAt(completedAt, tz);
      const action = await createAction({
        habitId,
        completedAt: completedAtISO,
        actualDurationMinutes,
        notes,
        withPersonIds,
        forPersonIds,
      });
      const habit = await getHabitById(habitId);
      return jsonResponse({
        action: {
          id: action.id,
          habit: habit ? { id: habit.id, name: habit.name } : { id: habitId, name: null },
          completedAt: action.completedAt,
          actualDurationMinutes: actualDurationMinutes ?? null,
          notes: notes ?? null,
          withPersonIds: withPersonIds ?? [],
          forPersonIds: forPersonIds ?? [],
          createdAt: action.createdAt,
        },
      });
    }
  );

  server.registerTool(
    "list_actions",
    {
      title: "List Actions",
      description:
        "Lists tracked actions. Use period (today, yesterday, this_week) or fromDate/toDate. Optionally filter by habit.",
      inputSchema: {
        habitId: z.string().optional().describe("Filter by habit ID"),
        period: z
          .enum(["today", "yesterday", "this_week"])
          .optional()
          .describe("Convenience: today, yesterday, or this_week (Mon-Sun)"),
        fromDate: z.string().optional().describe("From date (YYYY-MM-DD). Ignored if period is set."),
        toDate: z.string().optional().describe("To date (YYYY-MM-DD). Ignored if period is set."),
      },
    },
    async ({ habitId, period, fromDate, toDate }) => {
      let resolvedFrom = fromDate;
      let resolvedTo = toDate;
      if (period) {
        const { getUserTimezone, periodToDateRange } = await import("../utils/timezone.js");
        const tz = await getUserTimezone();
        const range = periodToDateRange(period, tz);
        resolvedFrom = range.fromDate;
        resolvedTo = range.toDate;
      }
      const actions = await listActions({ habitId, fromDate: resolvedFrom, toDate: resolvedTo });
      // Preload habits, ends, and persons in bulk — O(3) queries instead of O(N) per action.
      const allHabits = await listHabits();
      const habitsMap = new Map(allHabits.map((h) => [h.id, h]));
      const allEnds = await listEnds();
      const endsMap = new Map(allEnds.map((e) => [e.id, e]));
      const allPersons = await listPersons();
      const personsMap = new Map(allPersons.map((p) => [p.id, p]));

      const formatPerson = (pid: string) => {
        const p = personsMap.get(pid);
        return p ? { id: p.id, firstName: p.firstName, lastName: p.lastName } : { id: pid, firstName: pid, lastName: "" };
      };

      return jsonResponse({
        actions: actions.map((a) => {
          const habit = habitsMap.get(a.habitId);
          const endEntity = habit?.endId ? endsMap.get(habit.endId) : undefined;
          const end = endEntity ? { id: endEntity.id, name: endEntity.name } : habit?.endId ? { id: habit.endId, name: null } : null;
          return {
            id: a.id,
            habit: habit ? { id: habit.id, name: habit.name } : { id: a.habitId, name: null },
            completedAt: a.completedAt,
            end,
            actualDurationMinutes: a.actualDurationMinutes ?? null,
            notes: a.notes ?? null,
            withPersons: a.withPersonIds?.map(formatPerson) ?? [],
            forPersons: a.forPersonIds?.map(formatPerson) ?? [],
          };
        }),
        count: actions.length,
      });
    }
  );

  server.registerTool(
    "get_action",
    {
      title: "Get Action",
      description: "Gets a single action by ID with full details.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the action"),
      },
    },
    async ({ id }) => {
      const { getActionById } = await import("../store/actions.js");
      const action = await getActionById(id);
      if (!action) {
        return errorResponse(`Action with ID ${id} not found.`);
      }
      const habit = await getHabitById(action.habitId);
      const withPersons = action.withPersonIds?.length
        ? await Promise.all(action.withPersonIds.map(async (pid) => { const p = await getPersonById(pid); return p ? { id: p.id, firstName: p.firstName, lastName: p.lastName } : { id: pid, firstName: pid, lastName: "" }; }))
        : [];
      const forPersons = action.forPersonIds?.length
        ? await Promise.all(action.forPersonIds.map(async (pid) => { const p = await getPersonById(pid); return p ? { id: p.id, firstName: p.firstName, lastName: p.lastName } : { id: pid, firstName: pid, lastName: "" }; }))
        : [];
      return jsonResponse({
        action: {
          id: action.id,
          habit: habit ? { id: habit.id, name: habit.name } : { id: action.habitId, name: null },
          completedAt: action.completedAt,
          actualDurationMinutes: action.actualDurationMinutes ?? null,
          notes: action.notes ?? null,
          withPersons,
          forPersons,
          createdAt: action.createdAt,
        },
      });
    }
  );

  server.registerTool(
    "update_action",
    {
      title: "Update Action",
      description: "Updates an action's date, duration, notes, or with/for persons.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the action to update"),
        completedAt: z.string().optional().describe("When completed: 'today' | 'yesterday' | YYYY-MM-DD | full ISO timestamp"),
        actualDurationMinutes: z.number().optional().describe("New duration in minutes"),
        notes: z.string().optional().describe("New notes"),
        withPersonIds: z.array(z.string()).optional().describe("Replace with-person IDs"),
        forPersonIds: z.array(z.string()).optional().describe("Replace for-person IDs"),
      },
    },
    async ({ id, completedAt, actualDurationMinutes, notes, withPersonIds, forPersonIds }) => {
      const { updateAction } = await import("../store/actions.js");
      const updates: Record<string, unknown> = {};
      if (completedAt !== undefined) {
        const { getUserTimezone, resolveCompletedAt } = await import("../utils/timezone.js");
        const tz = await getUserTimezone();
        updates.completedAt = resolveCompletedAt(completedAt, tz);
      }
      if (actualDurationMinutes !== undefined) updates.actualDurationMinutes = actualDurationMinutes;
      if (notes !== undefined) updates.notes = notes;
      if (withPersonIds !== undefined) updates.withPersonIds = withPersonIds;
      if (forPersonIds !== undefined) updates.forPersonIds = forPersonIds;
      const action = await updateAction(id, updates);
      if (!action) {
        return errorResponse(`Action with ID ${id} not found.`);
      }
      return jsonResponse({
        action: {
          id: action.id,
          habitId: action.habitId,
          completedAt: action.completedAt,
          actualDurationMinutes: action.actualDurationMinutes ?? null,
          notes: action.notes ?? null,
          withPersonIds: action.withPersonIds ?? [],
          forPersonIds: action.forPersonIds ?? [],
        },
      });
    }
  );

  server.registerTool(
    "delete_action",
    {
      title: "Delete Action",
      description: "Deletes a tracked action by ID.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the action to delete"),
      },
    },
    async ({ id }) => {
      const deleted = await deleteAction(id);
      if (!deleted) {
        return errorResponse(`Action with ID ${id} not found.`);
      }
      return jsonResponse({ deleted: { id: deleted.id } });
    }
  );

  // ============================================================================
  // UNIFIED ACTIVITY
  // ============================================================================

  server.registerTool(
    "list_activity",
    {
      title: "List Activity",
      description:
        "Unified activity log — merges habit actions and task time entries, sorted chronologically. Use instead of separate list_actions + list_task_time calls. Supports groupBy for area/end/portfolio breakdowns.",
      inputSchema: {
        period: z.enum(["today", "yesterday", "this_week"]).optional().describe("Convenience period. Mutually exclusive with fromDate/toDate."),
        fromDate: z.string().optional().describe("Start date (YYYY-MM-DD). Ignored if period is set."),
        toDate: z.string().optional().describe("End date (YYYY-MM-DD). Ignored if period is set."),
        endId: z.string().optional().describe("Filter by end ID"),
        areaId: z.string().optional().describe("Filter by area ID"),
        groupBy: z.enum(["area", "end", "portfolio"]).optional().describe("Group results by area, end, or portfolio"),
        order: z.enum(["asc", "desc"]).optional().describe("Sort by completedAt: desc (default, newest first) or asc"),
      },
    },
    async ({ period, fromDate, toDate, endId, areaId, groupBy, order }) => {
      // Resolve date range
      let resolvedFrom = fromDate;
      let resolvedTo = toDate;
      if (period) {
        const { getUserTimezone, periodToDateRange } = await import("../utils/timezone.js");
        const tz = await getUserTimezone();
        const range = periodToDateRange(period, tz);
        resolvedFrom = range.fromDate;
        resolvedTo = range.toDate;
      }

      // Fetch both data sets in parallel
      const { listTaskTime } = await import("../store/taskTime.js");
      const [actions, taskTimeEntries] = await Promise.all([
        listActions({ fromDate: resolvedFrom, toDate: resolvedTo }),
        listTaskTime({ fromDate: resolvedFrom, toDate: resolvedTo }),
      ]);

      // Bulk preload all related entities
      const allHabits = await listHabits();
      const habitsMap = new Map(allHabits.map((h) => [h.id, h]));
      const allTasks = await listTasks();
      const tasksMap = new Map(allTasks.map((t) => [t.id, t]));
      const allEnds = await listEnds();
      const endsMap = new Map(allEnds.map((e) => [e.id, e]));
      const allAreas = await listAreas();
      const areasMap = new Map(allAreas.map((a) => [a.id, a]));
      const allPersons = await listPersons();
      const personsMap = new Map(allPersons.map((p) => [p.id, p]));
      const allPortfolios = await listPortfolios();
      const portfoliosMap = new Map(allPortfolios.map((p) => [p.id, p]));

      const formatPerson = (pid: string) => {
        const p = personsMap.get(pid);
        return p ? { id: p.id, firstName: p.firstName, lastName: p.lastName ?? "" } : { id: pid, firstName: pid, lastName: "" };
      };

      const resolveEndAndArea = (endIdVal: string | undefined) => {
        const end = endIdVal ? endsMap.get(endIdVal) : undefined;
        const area = end?.areaId ? areasMap.get(end.areaId) : undefined;
        return {
          end: end ? { id: end.id, name: end.name } : null,
          area: area ? { id: area.id, name: area.name } : null,
          portfolioId: end?.portfolioId ?? null,
        };
      };

      // Build unified activity list
      type Activity = {
        id: string;
        type: "action" | "task_time";
        name: string;
        completedAt: string;
        actualDurationMinutes: number | null;
        notes: string | null;
        end: { id: string; name: string } | null;
        area: { id: string; name: string } | null;
        portfolioId: string | null;
        withPersons: { id: string; firstName: string; lastName: string }[];
        forPersons: { id: string; firstName: string; lastName: string }[];
      };

      const activities: Activity[] = [];

      for (const a of actions) {
        const habit = habitsMap.get(a.habitId);
        const resolved = resolveEndAndArea(habit?.endId);

        // Apply filters
        if (endId && resolved.end?.id !== endId) continue;
        if (areaId && resolved.area?.id !== areaId) continue;

        activities.push({
          id: a.id,
          type: "action",
          name: habit?.name ?? a.habitId,
          completedAt: a.completedAt,
          actualDurationMinutes: a.actualDurationMinutes ?? null,
          notes: a.notes ?? null,
          end: resolved.end,
          area: resolved.area,
          portfolioId: resolved.portfolioId,
          withPersons: (a.withPersonIds ?? []).map(formatPerson),
          forPersons: (a.forPersonIds ?? []).map(formatPerson),
        });
      }

      for (const tt of taskTimeEntries) {
        const task = tasksMap.get(tt.taskId);
        const resolved = resolveEndAndArea(task?.endId);

        // Apply filters
        if (endId && resolved.end?.id !== endId) continue;
        if (areaId && resolved.area?.id !== areaId) continue;

        activities.push({
          id: tt.id,
          type: "task_time",
          name: task?.name ?? tt.taskId,
          completedAt: tt.completedAt,
          actualDurationMinutes: tt.actualDurationMinutes ?? null,
          notes: tt.notes ?? null,
          end: resolved.end,
          area: resolved.area,
          portfolioId: resolved.portfolioId,
          withPersons: (tt.withPersonIds ?? []).map(formatPerson),
          forPersons: (tt.forPersonIds ?? []).map(formatPerson),
        });
      }

      // Sort
      const sortDir = order === "asc" ? 1 : -1;
      activities.sort((a, b) => sortDir * (new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()));

      const totalDuration = activities.reduce((sum, a) => sum + (a.actualDurationMinutes ?? 0), 0);

      // Grouped response
      if (groupBy) {
        const groupMap = new Map<string, { group: { id: string; name: string } | null; items: Activity[] }>();

        for (const a of activities) {
          let groupKey: string;
          let groupObj: { id: string; name: string } | null;

          if (groupBy === "area") {
            groupKey = a.area?.id ?? "__null__";
            groupObj = a.area;
          } else if (groupBy === "end") {
            groupKey = a.end?.id ?? "__null__";
            groupObj = a.end;
          } else {
            // portfolio
            const portfolio = a.portfolioId ? portfoliosMap.get(a.portfolioId) : undefined;
            groupKey = portfolio?.id ?? "__null__";
            groupObj = portfolio ? { id: portfolio.id, name: portfolio.name } : null;
          }

          if (!groupMap.has(groupKey)) {
            groupMap.set(groupKey, { group: groupObj, items: [] });
          }
          groupMap.get(groupKey)!.items.push(a);
        }

        const groups = Array.from(groupMap.values()).map((g) => ({
          group: g.group,
          activities: g.items,
          count: g.items.length,
          totalDurationMinutes: g.items.reduce((sum, a) => sum + (a.actualDurationMinutes ?? 0), 0),
        }));

        return jsonResponse({
          groupBy,
          groups,
          count: activities.length,
          totalDurationMinutes: totalDuration,
        });
      }

      return jsonResponse({
        activities,
        count: activities.length,
        totalDurationMinutes: totalDuration,
      });
    }
  );

  // ============================================================================
  // TASK TOOLS
  // ============================================================================

  server.registerTool(
    "create_task",
    {
      title: "Create Task",
      description:
        "Creates a task — one-off or recurring. For recurring tasks, set `recurrence` (e.g. 'weekly', 'every 6 weeks'). When `recurrence` is provided and `nextDueAt` is not, compute `nextDueAt` from the recurrence string and `completedAt` (or today if not provided) before calling this tool. Server also computes as fallback.",
      inputSchema: {
        name: z.string().min(1).describe("Task name"),
        endId: z.string().optional().describe("End this task supports"),
        areaId: z.string().optional().describe("Area this task belongs to"),
        withPersonIds: z.array(z.string()).optional().describe("Person IDs - did it with"),
        forPersonIds: z.array(z.string()).optional().describe("Person IDs - did it for"),
        dueDate: z.string().optional().describe("Due date (YYYY-MM-DD) for one-off tasks"),
        scheduledDate: z.string().optional().describe("Scheduled work date (YYYY-MM-DD)"),
        estimatedDurationMinutes: z.number().optional().describe("Estimated time to complete (minutes)"),
        recurrence: z.string().optional().describe("Natural language recurrence (e.g. 'weekly', 'monthly', 'every 6 weeks'). Makes this a recurring task."),
        completedAt: z.string().optional().describe("For recurring tasks created retroactively: the last completion date. Sets last_completed_at and computes next_due_at from it."),
        nextDueAt: z.string().optional().describe("Override computed next due date (ISO). Recurrence logic resumes on next completion."),
        notes: z.string().optional(),
      },
    },
    async ({ name, endId, areaId, withPersonIds, forPersonIds, dueDate, scheduledDate, estimatedDurationMinutes, recurrence, completedAt, nextDueAt, notes }) => {
      let resolvedCompletedAt = completedAt;
      let resolvedNextDueAt = nextDueAt;
      if (completedAt) {
        const { getUserTimezone, resolveCompletedAt: resolve } = await import("../utils/timezone.js");
        const tz = await getUserTimezone();
        resolvedCompletedAt = resolve(completedAt, tz);
      }
      if (nextDueAt) {
        const { getUserTimezone, resolveCompletedAt: resolve } = await import("../utils/timezone.js");
        const tz = await getUserTimezone();
        resolvedNextDueAt = resolve(nextDueAt, tz);
      }
      const task = await createTask({
        name,
        endId,
        areaId,
        withPersonIds,
        forPersonIds,
        dueDate,
        scheduledDate,
        estimatedDurationMinutes,
        recurrence,
        completedAt: resolvedCompletedAt,
        nextDueAt: resolvedNextDueAt,
        notes,
      });
      const end = task.endId ? await getEndById(task.endId) : undefined;
      const area = task.areaId
        ? await getAreaById(task.areaId)
        : end?.areaId ? await getAreaById(end.areaId) : undefined;
      const areaSource: "direct" | "via_end" | null = task.areaId ? "direct" : area ? "via_end" : null;
      return jsonResponse({
        task: {
          id: task.id,
          name: task.name,
          end: end ? { id: end.id, name: end.name } : null,
          area: area ? { id: area.id, name: area.name } : null,
          areaSource,
          dueDate: task.dueDate ?? null,
          scheduledDate: task.scheduledDate ?? null,
          estimatedDurationMinutes: task.estimatedDurationMinutes ?? null,
          recurrence: task.recurrence ?? null,
          nextDueAt: task.nextDueAt ?? null,
          lastCompletedAt: task.lastCompletedAt ?? null,
          completedAt: task.completedAt ?? null,
          createdAt: task.createdAt,
        },
      });
    }
  );

  server.registerTool(
    "list_tasks",
    {
      title: "List Tasks",
      description: "Lists tasks. Filter by end, area, or completion status. areaId matches tasks with a direct area OR tasks linked to an end in that area. Use dueBy to narrow to tasks due by a specific date (checks both due_date and next_due_at for recurring tasks).",
      inputSchema: {
        endId: z.string().optional().describe("Filter by end ID"),
        areaId: z.string().optional().describe("Filter by area ID"),
        completed: z.boolean().optional().describe("Filter: true = completed only, false = open only"),
        dueBy: z.string().optional().describe("Only show tasks due by this date (YYYY-MM-DD). Checks both due_date and next_due_at."),
      },
    },
    async ({ endId, areaId, completed, dueBy }) => {
      const tasks = await listTasks({ endId, areaId, completed, dueBy });
      const allAreas = await listAreas();
      const allEnds = await listEnds();
      const taskObjs = await Promise.all(tasks.map(async (t) => {
        const end = t.endId ? allEnds.find((e) => e.id === t.endId) : undefined;
        const area = t.areaId
          ? allAreas.find((a) => a.id === t.areaId)
          : end?.areaId ? allAreas.find((a) => a.id === end.areaId) : undefined;
        const areaSource = t.areaId ? "direct" : area ? "via_end" : null;
        const withPersons = t.withPersonIds?.length
          ? await Promise.all(t.withPersonIds.map(async (pid) => {
              const p = await getPersonById(pid);
              return p ? { id: p.id, firstName: p.firstName, lastName: p.lastName } : { id: pid, firstName: pid, lastName: "" };
            }))
          : [];
        const forPersons = t.forPersonIds?.length
          ? await Promise.all(t.forPersonIds.map(async (pid) => {
              const p = await getPersonById(pid);
              return p ? { id: p.id, firstName: p.firstName, lastName: p.lastName } : { id: pid, firstName: pid, lastName: "" };
            }))
          : [];
        return {
          id: t.id,
          name: t.name,
          completedAt: t.completedAt ?? null,
          end: end ? { id: end.id, name: end.name } : null,
          area: area ? { id: area.id, name: area.name, source: areaSource } : null,
          dueDate: t.dueDate ?? null,
          scheduledDate: t.scheduledDate ?? null,
          estimatedDurationMinutes: t.estimatedDurationMinutes ?? null,
          recurrence: t.recurrence ?? null,
          nextDueAt: t.nextDueAt ?? null,
          lastCompletedAt: t.lastCompletedAt ?? null,
          withPersons,
          forPersons,
        };
      }));
      return jsonResponse({ tasks: taskObjs, count: tasks.length });
    }
  );

  server.registerTool(
    "get_task",
    {
      title: "Get Task",
      description: "Gets a single task by ID with full details.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the task to fetch"),
      },
    },
    async ({ id }) => {
      const task = await getTaskById(id);
      if (!task) {
        return errorResponse(`Task with ID ${id} not found.`);
      }
      const end = task.endId ? await getEndById(task.endId) : undefined;
      const area = task.areaId
        ? await getAreaById(task.areaId)
        : end?.areaId ? await getAreaById(end.areaId) : undefined;
      const areaSource: "direct" | "via_end" | null = task.areaId ? "direct" : area ? "via_end" : null;
      const withPersons = task.withPersonIds?.length
        ? await Promise.all(task.withPersonIds.map(async (pid) => { const p = await getPersonById(pid); return p ? { id: p.id, firstName: p.firstName, lastName: p.lastName } : { id: pid, firstName: pid, lastName: "" }; }))
        : [];
      const forPersons = task.forPersonIds?.length
        ? await Promise.all(task.forPersonIds.map(async (pid) => { const p = await getPersonById(pid); return p ? { id: p.id, firstName: p.firstName, lastName: p.lastName } : { id: pid, firstName: pid, lastName: "" }; }))
        : [];
      return jsonResponse({
        task: {
          id: task.id,
          name: task.name,
          completedAt: task.completedAt ?? null,
          end: end ? { id: end.id, name: end.name } : null,
          area: area ? { id: area.id, name: area.name } : null,
          areaSource,
          dueDate: task.dueDate ?? null,
          scheduledDate: task.scheduledDate ?? null,
          estimatedDurationMinutes: task.estimatedDurationMinutes ?? null,
          recurrence: task.recurrence ?? null,
          nextDueAt: task.nextDueAt ?? null,
          lastCompletedAt: task.lastCompletedAt ?? null,
          withPersons,
          forPersons,
          notes: task.notes ?? null,
          createdAt: task.createdAt,
        },
      });
    }
  );

  server.registerTool(
    "update_task",
    {
      title: "Update Task",
      description:
        "Updates a task. Use to complete, reopen, schedule, estimate time, change details, set recurrence, or add with/for. When completing a recurring task (one with a `recurrence` value), compute `nextDueAt` from the recurrence string and `completedAt` before calling this tool. When `recurrence` changes and `nextDueAt` is not provided, recompute `nextDueAt` from the new recurrence string and `lastCompletedAt` (or `createdAt` if never completed). When `nextDueAt` is provided directly, it's a one-cycle override — recurrence logic resumes on next completion. Server enforces all of this as fallback.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the task to update"),
        name: z.string().min(1).optional().describe("Task name"),
        endId: z.string().optional().describe("End ID"),
        areaId: z.string().optional().describe("Area ID"),
        withPersonIds: z.array(z.string()).optional().describe("Person IDs - did it with"),
        forPersonIds: z.array(z.string()).optional().describe("Person IDs - did it for"),
        dueDate: z.string().optional().describe("Due date (YYYY-MM-DD) for one-off tasks"),
        scheduledDate: z.string().optional().describe("Scheduled work date (YYYY-MM-DD)"),
        estimatedDurationMinutes: z.number().optional().describe("Estimated time to complete (minutes)"),
        completedAt: z.string().nullable().optional().describe("When completed: 'today' | 'yesterday' | YYYY-MM-DD | ISO. Set to mark complete, null to reopen. Recurring tasks auto-reopen."),
        recurrence: z.string().optional().describe("Natural language recurrence (e.g. 'weekly', 'every 6 weeks'). Set to make/change recurrence, empty string to remove."),
        nextDueAt: z.string().optional().describe("Override next due date (ISO or YYYY-MM-DD). One-cycle override; recurrence logic resumes on next completion."),
        notes: z.string().optional(),
      },
    },
    async ({ id, name, endId, areaId, withPersonIds, forPersonIds, dueDate, scheduledDate, estimatedDurationMinutes, completedAt, recurrence, nextDueAt, notes }) => {
      const updates: Record<string, unknown> = {};
      if (name != null) updates.name = name;
      if (endId !== undefined) updates.endId = endId;
      if (areaId !== undefined) updates.areaId = areaId;
      if (withPersonIds !== undefined) updates.withPersonIds = withPersonIds;
      if (forPersonIds !== undefined) updates.forPersonIds = forPersonIds;
      if (dueDate !== undefined) updates.dueDate = dueDate;
      if (scheduledDate !== undefined) updates.scheduledDate = scheduledDate;
      if (estimatedDurationMinutes !== undefined) updates.estimatedDurationMinutes = estimatedDurationMinutes;
      if (notes !== undefined) updates.notes = notes;
      if (recurrence !== undefined) updates.recurrence = recurrence || null;

      // Resolve completedAt and nextDueAt through timezone helpers
      if (completedAt !== undefined) {
        if (completedAt !== null) {
          const { getUserTimezone, resolveCompletedAt: resolve } = await import("../utils/timezone.js");
          const tz = await getUserTimezone();
          updates.completedAt = resolve(completedAt, tz);
        } else {
          updates.completedAt = null;
        }
      }
      if (nextDueAt !== undefined) {
        const { getUserTimezone, resolveCompletedAt: resolve } = await import("../utils/timezone.js");
        const tz = await getUserTimezone();
        updates.nextDueAt = resolve(nextDueAt, tz);
      }

      const task = await updateTask(id, updates as Parameters<typeof updateTask>[1]);
      if (!task) {
        return errorResponse(`Task with ID ${id} not found.`);
      }
      const end = task.endId ? await getEndById(task.endId) : undefined;
      const area = task.areaId
        ? await getAreaById(task.areaId)
        : end?.areaId ? await getAreaById(end.areaId) : undefined;
      const areaSource: "direct" | "via_end" | null = task.areaId ? "direct" : area ? "via_end" : null;
      return jsonResponse({
        task: {
          id: task.id,
          name: task.name,
          completedAt: task.completedAt ?? null,
          end: end ? { id: end.id, name: end.name } : null,
          area: area ? { id: area.id, name: area.name } : null,
          areaSource,
          dueDate: task.dueDate ?? null,
          scheduledDate: task.scheduledDate ?? null,
          estimatedDurationMinutes: task.estimatedDurationMinutes ?? null,
          recurrence: task.recurrence ?? null,
          nextDueAt: task.nextDueAt ?? null,
          lastCompletedAt: task.lastCompletedAt ?? null,
        },
      });
    }
  );

  server.registerTool(
    "delete_task",
    {
      title: "Delete Task",
      description: "Deletes a task by ID.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the task to delete"),
      },
    },
    async ({ id }) => {
      const deleted = await deleteTask(id);
      if (!deleted) {
        return errorResponse(`Task with ID ${id} not found.`);
      }
      return jsonResponse({ deleted: { id, name: deleted.name } });
    }
  );

  // --- Task Time ---

  server.registerTool(
    "log_task_time",
    {
      title: "Log Task Time",
      description: "Records a work session against a task. Different from completing the task — this tracks time spent.",
      inputSchema: {
        taskId: z.string().min(1).describe("ID of the task"),
        completedAt: z.string().describe("When the work happened: 'today' | 'yesterday' | YYYY-MM-DD | full ISO timestamp"),
        actualDurationMinutes: z.number().optional().describe("Duration in minutes"),
        notes: z.string().optional().describe("Notes about what was done"),
        withPersonIds: z.array(z.string()).optional().describe("Person IDs worked with"),
        forPersonIds: z.array(z.string()).optional().describe("Person IDs worked for"),
      },
    },
    async ({ taskId, completedAt, actualDurationMinutes, notes, withPersonIds, forPersonIds }) => {
      const { createTaskTime } = await import("../store/taskTime.js");
      const { getUserTimezone, resolveCompletedAt } = await import("../utils/timezone.js");
      const tz = await getUserTimezone();
      const completedAtISO = resolveCompletedAt(completedAt, tz);
      const entry = await createTaskTime({ taskId, completedAt: completedAtISO, actualDurationMinutes, notes, withPersonIds, forPersonIds });
      return jsonResponse({
        taskTime: {
          id: entry.id,
          taskId: entry.taskId,
          completedAt: entry.completedAt,
          actualDurationMinutes: entry.actualDurationMinutes ?? null,
          notes: entry.notes ?? null,
          withPersonIds: entry.withPersonIds ?? [],
          forPersonIds: entry.forPersonIds ?? [],
        },
      });
    }
  );

  server.registerTool(
    "list_task_time",
    {
      title: "List Task Time",
      description: "Lists task time entries. Filter by task, or by date range.",
      inputSchema: {
        taskId: z.string().optional().describe("Filter by task ID"),
        fromDate: z.string().optional().describe("YYYY-MM-DD start date"),
        toDate: z.string().optional().describe("YYYY-MM-DD end date"),
      },
    },
    async ({ taskId, fromDate, toDate }) => {
      const { listTaskTime } = await import("../store/taskTime.js");
      const entries = await listTaskTime({ taskId, fromDate, toDate });
      const entryObjs = await Promise.all(entries.map(async (e) => {
        const task = await getTaskById(e.taskId);
        const withPersons = e.withPersonIds?.length
          ? await Promise.all(e.withPersonIds.map(async (pid) => {
              const p = await getPersonById(pid);
              return p ? { id: p.id, firstName: p.firstName, lastName: p.lastName } : { id: pid, firstName: pid, lastName: "" };
            }))
          : [];
        return {
          id: e.id,
          task: task ? { id: task.id, name: task.name } : { id: e.taskId, name: null },
          completedAt: e.completedAt,
          actualDurationMinutes: e.actualDurationMinutes ?? null,
          notes: e.notes ?? null,
          withPersons,
        };
      }));
      return jsonResponse({ taskTimeEntries: entryObjs, count: entries.length });
    }
  );

  server.registerTool(
    "delete_task_time",
    {
      title: "Delete Task Time",
      description: "Deletes a task time entry by ID.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the task time entry"),
      },
    },
    async ({ id }) => {
      const { deleteTaskTime } = await import("../store/taskTime.js");
      const entry = await deleteTaskTime(id);
      if (!entry) {
        return errorResponse(`Task time entry ${id} not found.`);
      }
      return jsonResponse({ deleted: { id } });
    }
  );

  server.registerTool(
    "create_person",
    {
      title: "Create Person",
      description:
        "Creates a new person entity. Check list_people or get_person first to avoid duplicates; if the person exists, use update_person to add them to new groups instead.",
      inputSchema: {
        firstName: z.string().min(1).describe("First name of the person (required)"),
        lastName: z.string().optional().describe("Last name of the person"),
        email: z.string().email().optional().describe("Email address"),
        phone: z.string().optional().describe("Phone number"),
        title: z.string().optional().describe("Job title or role"),
        notes: z.string().optional().describe("Additional notes about the person"),
        teamIds: z
          .array(z.string())
          .optional()
          .describe("IDs of teams this person belongs to"),
        relationshipType: z
          .enum(["self", "spouse", "child", "parent", "sibling", "in-law", "friend", "colleague", "mentor", "client", "other"])
          .optional()
          .describe("Type of relationship (e.g. spouse, child, friend, colleague)"),
        userId: z.string().optional().describe("Link to User when this Person has an account"),
      },
    },
    async ({ firstName, lastName, email, phone, title, notes, teamIds, relationshipType, userId }) => {
      const person = await createPerson({
        firstName,
        lastName,
        email,
        phone,
        title,
        notes,
        teamIds: teamIds ?? [],
        relationshipType: relationshipType as RelationshipType | undefined,
        userId,
      });

      return jsonResponse({
        person: {
          id: person.id,
          firstName: person.firstName,
          lastName: person.lastName ?? null,
          email: person.email ?? null,
          phone: person.phone ?? null,
          title: person.title ?? null,
          notes: person.notes ?? null,
          relationshipType: person.relationshipType ?? null,
          teamIds: person.teamIds ?? [],
          createdAt: person.createdAt,
          duplicateWarning: person.duplicateWarning ?? null,
        },
      });
    }
  );

  server.registerTool(
    "get_person",
    {
      title: "Get Person",
      description:
        "Gets a single person by ID with full details (teams, relationship, etc.). Use to verify a person exists or fetch their details before update_person.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the person to fetch"),
      },
    },
    async ({ id }) => {
      const person = await getPersonById(id);
      if (!person) {
        return errorResponse(`Person with ID ${id} not found.`);
      }
      const teams: { id: string; name: string | null }[] = [];
      for (const tId of person.teamIds ?? []) {
        const team = await getTeamById(tId);
        teams.push(team ? { id: team.id, name: team.name } : { id: tId, name: null });
      }
      return jsonResponse({
        person: {
          id: person.id,
          firstName: person.firstName,
          lastName: person.lastName ?? null,
          email: person.email ?? null,
          phone: person.phone ?? null,
          title: person.title ?? null,
          relationshipType: person.relationshipType ?? null,
          teams,
          createdAt: person.createdAt,
        },
      });
    }
  );

  server.registerTool(
    "list_people",
    {
      title: "List People",
      description:
        "Lists people. Optionally filter by organization ID, team ID, or relationship type.",
      inputSchema: {
        organizationId: z.string().optional().describe("Filter by organization ID"),
        teamId: z.string().optional().describe("Filter by team ID"),
        relationshipType: z
          .enum(["self", "spouse", "child", "parent", "sibling", "in-law", "friend", "colleague", "mentor", "client", "other"])
          .optional()
          .describe("Filter by relationship type"),
      },
    },
    async ({ organizationId, teamId, relationshipType }) => {
      const people = await listPersons({ organizationId, teamId, relationshipType });

      const personObjs = await Promise.all(
        people.map(async (p) => {
          const teams: { id: string; name: string | null }[] = [];
          for (const tId of p.teamIds ?? []) {
            const team = await getTeamById(tId);
            teams.push(team ? { id: team.id, name: team.name } : { id: tId, name: null });
          }
          return {
            id: p.id,
            firstName: p.firstName,
            lastName: p.lastName ?? null,
            email: p.email ?? null,
            userId: p.userId ?? null,
            phone: p.phone ?? null,
            title: p.title ?? null,
            relationshipType: p.relationshipType ?? null,
            teams,
            createdAt: p.createdAt,
          };
        })
      );

      return jsonResponse({ people: personObjs, count: people.length });
    }
  );

  server.registerTool(
    "set_timezone",
    {
      title: "Set Timezone",
      description: "Sets the user's timezone for date calculations. Use IANA timezone names (e.g. America/New_York, Europe/London, Asia/Tokyo).",
      inputSchema: {
        timezone: z.string().min(1).describe("IANA timezone name (e.g. America/New_York)"),
      },
    },
    async ({ timezone }) => {
      // Validate timezone
      try {
        Intl.DateTimeFormat(undefined, { timeZone: timezone });
      } catch {
        return errorResponse(`Invalid timezone: "${timezone}". Use IANA format like America/New_York.`);
      }
      const { updateUserTimezone } = await import("../store/users.js");
      await updateUserTimezone(timezone);
      return jsonResponse({ timezone });
    }
  );

  server.registerTool(
    "list_users",
    {
      title: "List Users",
      description:
        "Lists users (account holders). For testing Person vs User linkage: Person.id is the representation; User.id is the account. When Person.userId is set, that Person is linked to this User.",
      inputSchema: {},
    },
    async () => {
      const users = await listUsers();
      return jsonResponse({
        users: users.map((u) => ({ id: u.id, displayName: u.displayName, email: u.email })),
        count: users.length,
      });
    }
  );

  server.registerTool(
    "update_person",
    {
      title: "Update Person",
      description:
        "Updates an existing person by ID. Use get_person or list_people to find the person. To add a person to new teams, use teamIdsToAdd (merges with existing). Use teamIds only to replace the entire list.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the person to update"),
        firstName: z.string().min(1).optional().describe("First name"),
        lastName: z.string().optional().describe("Last name"),
        email: z.string().email().optional().describe("Email address"),
        phone: z.string().optional().describe("Phone number"),
        title: z.string().optional().describe("Job title or role"),
        notes: z.string().optional().describe("Additional notes"),
        teamIds: z.array(z.string()).optional().describe("Team IDs (replaces entire list)"),
        teamIdsToAdd: z.array(z.string()).optional().describe("Team IDs to add (merges with existing; use when adding person to new teams)"),
        relationshipType: z
          .enum(["self", "spouse", "child", "parent", "sibling", "in-law", "friend", "colleague", "mentor", "client", "other"])
          .optional()
          .describe("Relationship type"),
        userId: z.string().optional().describe("Link to User when this Person has an account"),
      },
    },
    async ({ id, firstName, lastName, email, phone, title, notes, teamIds, teamIdsToAdd, relationshipType, userId }) => {
      const existing = await getPersonById(id);
      if (!existing) {
        return errorResponse(`Person with ID ${id} not found.`);
      }
      const updates: Record<string, unknown> = {};
      if (firstName != null) updates.firstName = firstName;
      if (lastName != null) updates.lastName = lastName;
      if (email != null) updates.email = email;
      if (phone !== undefined) updates.phone = phone;
      if (title !== undefined) updates.title = title;
      if (notes !== undefined) updates.notes = notes;
      if (teamIds !== undefined) updates.teamIds = teamIds;
      if (teamIdsToAdd !== undefined) updates.teamIdsToAdd = teamIdsToAdd;
      if (relationshipType !== undefined) updates.relationshipType = relationshipType;
      if (userId !== undefined) updates.userId = userId;
      const person = await updatePerson(id, updates as Parameters<typeof updatePerson>[1]);
      if (!person) {
        return errorResponse(`Person with ID ${id} not found.`);
      }
      return jsonResponse({
        person: {
          id: person.id,
          firstName: person.firstName,
          lastName: person.lastName ?? null,
          email: person.email ?? null,
          phone: person.phone ?? null,
          title: person.title ?? null,
          notes: person.notes ?? null,
          relationshipType: person.relationshipType ?? null,
          teamIds: person.teamIds ?? [],
        },
      });
    }
  );

  server.registerTool(
    "link_person",
    {
      title: "Link Person to User Account",
      description: "Links a person record to a user account by looking up the email in profiles. Optionally updates the person's email first.",
      inputSchema: {
        personId: z.string().min(1).describe("ID of the person to link"),
        emailOverride: z.string().optional().describe("If provided, updates the person's email before looking up"),
      },
    },
    async ({ personId, emailOverride }) => {
      const person = await getPersonById(personId);
      if (!person) {
        return errorResponse(`Person not found.`);
      }
      if (person.userId) {
        return jsonResponse({ linked: { personId, userId: person.userId, alreadyLinked: true } });
      }
      const lookupEmail = emailOverride ?? person.email;
      if (!lookupEmail || lookupEmail === "unknown@example.com") {
        return errorResponse(`${person.firstName} ${person.lastName} has no email on file.`);
      }
      if (emailOverride && emailOverride !== person.email) {
        await updatePerson(personId, { email: emailOverride });
      }
      const { getSupabase } = await import("../store/base.js");
      const supabase = getSupabase();
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", lookupEmail)
        .single();
      if (!profile) {
        return errorResponse(`No user account found for ${lookupEmail}.`);
      }
      await updatePerson(personId, { userId: profile.id });
      return jsonResponse({
        linked: {
          personId,
          userId: profile.id,
          email: lookupEmail,
          person: { id: person.id, firstName: person.firstName, lastName: person.lastName },
        },
      });
    }
  );

  server.registerTool(
    "delete_person",
    {
      title: "Delete Person",
      description: "Deletes a person by ID. Returns the deleted person's details or an error if not found.",
      inputSchema: {
        id: z.string().min(1).describe("ID of the person to delete"),
      },
    },
    async ({ id }) => {
      const deleted = await deletePerson(id);
      if (!deleted) {
        return errorResponse(`Person with ID ${id} not found.`);
      }
      return jsonResponse({ deleted: { id: deleted.id, firstName: deleted.firstName, lastName: deleted.lastName } });
    }
  );

  // ============================================================================
  // SHARING TOOLS
  // ============================================================================

  server.registerTool(
    "share_end",
    {
      title: "Share End",
      description:
        "Share an end (aspiration) with another user by their user ID. The shared user will have read-only access to the end and its habits/actions.",
      inputSchema: {
        endId: z.string().min(1).describe("ID of the end to share"),
        sharedWithUserId: z.string().min(1).describe("User ID of the person to share with"),
      },
    },
    async ({ endId, sharedWithUserId }) => {
      try {
        const share = await shareEnd(endId, sharedWithUserId);
        return jsonResponse({
          shared: {
            endId,
            endName: share.endName,
            sharedWithUserId,
            sharedWithEmail: share.sharedWithEmail,
          },
        });
      } catch (error) {
        return errorResponse(`Failed to share: ${(error as Error).message}`);
      }
    }
  );

  server.registerTool(
    "unshare_end",
    {
      title: "Unshare End",
      description:
        "Remove sharing of an end with a user. You can unshare ends you own, or remove yourself from ends shared with you.",
      inputSchema: {
        endId: z.string().min(1).describe("ID of the end to unshare"),
        userId: z.string().min(1).describe("ID of the user to remove sharing for"),
      },
    },
    async ({ endId, userId }) => {
      try {
        const removed = await unshareEnd(endId, userId);
        if (removed) {
          return jsonResponse({ unshared: { endId, userId } });
        } else {
          return errorResponse("Share not found.");
        }
      } catch (error) {
        return errorResponse(`Failed to unshare: ${(error as Error).message}`);
      }
    }
  );

  server.registerTool(
    "list_shared_ends",
    {
      title: "List Shared Ends",
      description:
        "Lists ends that have been shared with you by other users. These are read-only ends you can track progress on together.",
      inputSchema: {},
    },
    async () => {
      const ends = await listSharedEnds();
      return jsonResponse({
        sharedEnds: ends.map((e) => ({
          id: e.id,
          name: e.name,
          ownerDisplayName: e.ownerDisplayName ?? null,
        })),
        count: ends.length,
      });
    }
  );

  server.registerTool(
    "list_shared_habits",
    {
      title: "List Shared Habits",
      description: "Lists habits shared with you through shared ends, showing the owner and linked ends.",
      inputSchema: {},
    },
    async () => {
      const habits = await listHabitsWithShared();
      const shared = habits.filter((h) => h.isShared);
      const allEnds = await listEnds({ includeShared: true });
      return jsonResponse({
        sharedHabits: shared.map((h) => ({
          id: h.id,
          name: h.name,
          end: (() => {
            const e = h.endId ? allEnds.find((e) => e.id === h.endId) : undefined;
            return e ? { id: e.id, name: e.name } : h.endId ? { id: h.endId, name: null } : null;
          })(),
          ownerDisplayName: h.ownerDisplayName ?? null,
        })),
        count: shared.length,
      });
    }
  );

  server.registerTool(
    "list_my_shares",
    {
      title: "List My Shares",
      description: "Lists ends you have shared with other users.",
      inputSchema: {},
    },
    async () => {
      const shares = await listMyShares();
      return jsonResponse({
        shares: shares.map((s) => ({
          endId: s.endId,
          endName: s.endName,
          sharedWithUserId: s.sharedWithUserId,
          sharedWithEmail: s.sharedWithEmail,
        })),
        count: shares.length,
      });
    }
  );
}
