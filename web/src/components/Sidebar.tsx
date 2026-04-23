import { useState, useCallback } from "react";
import { callToolJson } from "../lib/mcp";

interface SidebarItem {
  id: string;
  name: string;
  subtitle?: string;
}

type JsonExtractor = (data: Record<string, unknown>) => SidebarItem[];

interface SidebarSection {
  key: string;
  label: string;
  tool?: string;
  args?: Record<string, unknown>;
  extract?: JsonExtractor;
  staticItems?: SidebarItem[];
}

interface SidebarProps {
  onSelectItem: (section: string, item: SidebarItem) => void;
  selectedId?: string;
}

// --- JSON extractors per entity type ---

function extractSimple(field: string): JsonExtractor {
  return (data) => {
    const items = data[field] as Array<{ id: string; name: string }> | undefined;
    return (items ?? []).map((item) => ({ id: item.id, name: item.name }));
  };
}

const extractEnds: JsonExtractor = (data) => {
  const items = data.ends as Array<{ id: string; name: string; endType?: string; state?: string }> | undefined;
  return (items ?? []).map((e) => {
    const meta: string[] = [];
    if (e.endType && e.endType !== "journey") meta.push(e.endType);
    if (e.state && e.state !== "active") meta.push(e.state);
    return { id: e.id, name: e.name, subtitle: meta.length ? meta.join(", ") : undefined };
  });
};

const extractTasks: JsonExtractor = (data) => {
  const items = data.tasks as Array<{ id: string; name: string; dueDate?: string | null; recurrence?: string | null }> | undefined;
  return (items ?? []).map((t) => {
    const meta: string[] = [];
    if (t.dueDate) meta.push(`due: ${t.dueDate}`);
    if (t.recurrence) meta.push(t.recurrence);
    return { id: t.id, name: t.name, subtitle: meta.length ? meta.join(", ") : undefined };
  });
};

const extractPeople: JsonExtractor = (data) => {
  const items = data.people as Array<{ id: string; firstName: string; lastName?: string; relationshipType?: string }> | undefined;
  return (items ?? []).map((p) => ({
    id: p.id,
    name: `${p.firstName}${p.lastName ? ` ${p.lastName}` : ""}`,
    subtitle: p.relationshipType,
  }));
};

const extractSharedEnds: JsonExtractor = (data) => {
  const items = data.sharedEnds as Array<{ id: string; name: string; ownerDisplayName?: string }> | undefined;
  return (items ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    subtitle: e.ownerDisplayName ? `by ${e.ownerDisplayName}` : undefined,
  }));
};

const extractSharedHabits: JsonExtractor = (data) => {
  const items = data.sharedHabits as Array<{ id: string; name: string; ownerDisplayName?: string }> | undefined;
  return (items ?? []).map((h) => ({
    id: h.id,
    name: h.name,
    subtitle: h.ownerDisplayName ? `by ${h.ownerDisplayName}` : undefined,
  }));
};

const extractMyShares: JsonExtractor = (data) => {
  const items = data.shares as Array<{ id: string; endName: string; sharedWithEmail?: string }> | undefined;
  return (items ?? []).map((s) => ({
    id: s.id,
    name: s.endName,
    subtitle: s.sharedWithEmail,
  }));
};

const sections: SidebarSection[] = [
  { key: "areas", label: "Areas", tool: "list_areas", extract: extractSimple("areas") },
  { key: "beliefs", label: "Beliefs", tool: "list_beliefs", extract: extractSimple("beliefs") },
  { key: "ends", label: "Ends", tool: "list_ends", extract: extractEnds },
  { key: "habits", label: "Habits", tool: "list_habits", extract: extractSimple("habits") },
  {
    key: "actions",
    label: "Actions",
    staticItems: [
      { id: "today", name: "Today" },
      { id: "yesterday", name: "Yesterday" },
      { id: "this_week", name: "This Week" },
      { id: "this_month", name: "This Month" },
    ],
  },
  { key: "tasks_open", label: "Tasks (Open)", tool: "list_tasks", args: { completed: false }, extract: extractTasks },
  {
    key: "tasks_completed",
    label: "Tasks (Completed)",
    staticItems: [
      { id: "this_week", name: "This Week" },
      { id: "this_month", name: "This Month" },
      { id: "all", name: "All" },
    ],
  },
  {
    key: "task_time",
    label: "Tasks (Time)",
    staticItems: [
      { id: "today", name: "Today" },
      { id: "yesterday", name: "Yesterday" },
      { id: "this_week", name: "This Week" },
      { id: "this_month", name: "This Month" },
    ],
  },
  { key: "organizations", label: "Organizations", tool: "list_organizations", args: { expand: false }, extract: extractSimple("organizations") },
  { key: "teams", label: "Teams", tool: "list_teams", extract: extractSimple("teams") },
  { key: "people", label: "People", tool: "list_people", extract: extractPeople },
  { key: "portfolios", label: "Portfolios", tool: "list_portfolios", extract: extractSimple("portfolios") },
  { key: "my_shares", label: "My Shares", tool: "list_my_shares", extract: extractMyShares },
  { key: "shared_ends", label: "Shared Ends", tool: "list_shared_ends", extract: extractSharedEnds },
  { key: "shared_habits", label: "Shared Habits", tool: "list_shared_habits", extract: extractSharedHabits },
];

export function Sidebar({ onSelectItem, selectedId }: SidebarProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [data, setData] = useState<Record<string, SidebarItem[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const loadSection = useCallback(
    async (section: SidebarSection) => {
      if (!section.tool || !section.extract) return;
      setLoading((prev) => ({ ...prev, [section.key]: true }));
      try {
        const { data: json, isError } = await callToolJson(section.tool, section.args ?? {});
        if (isError) {
          setData((prev) => ({ ...prev, [section.key]: [] }));
        } else {
          const items = section.extract(json as Record<string, unknown>);
          setData((prev) => ({ ...prev, [section.key]: items }));
        }
      } catch {
        setData((prev) => ({ ...prev, [section.key]: [] }));
      } finally {
        setLoading((prev) => ({ ...prev, [section.key]: false }));
      }
    },
    []
  );

  const toggleSection = useCallback(
    async (section: SidebarSection) => {
      const isOpen = expanded[section.key];
      setExpanded((prev) => ({ ...prev, [section.key]: !isOpen }));

      if (!isOpen && !data[section.key]) {
        if (section.staticItems) {
          setData((prev) => ({ ...prev, [section.key]: section.staticItems! }));
          return;
        }
        await loadSection(section);
      }
    },
    [expanded, data, loadSection]
  );

  return (
    <aside className="w-64 h-screen flex flex-col bg-white border-r border-gray-200 overflow-y-auto">
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
          Explorer
        </h2>
      </div>
      <nav className="flex-1">
        {sections.map((section) => (
          <div key={section.key}>
            {section.key === "my_shares" && (
              <div className="px-4 py-2 mt-2 border-t border-gray-200">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Shared With Others
                </span>
              </div>
            )}
            {section.key === "shared_ends" && (
              <div className="px-4 py-2 mt-2 border-t border-gray-200">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Shared With Me
                </span>
              </div>
            )}
            <button
              onClick={() => toggleSection(section)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <span className="flex items-center gap-2">
                <span className="text-gray-400 text-xs">
                  {expanded[section.key] ? "\u25BC" : "\u25B6"}
                </span>
                {section.label}
              </span>
              {expanded[section.key] && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    loadSection(section);
                  }}
                  className="text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
                  title="Refresh"
                >
                  {"\u21BB"}
                </span>
              )}
            </button>
            {expanded[section.key] && (
              <div className="pb-1">
                {loading[section.key] ? (
                  <p className="px-8 py-1.5 text-xs text-gray-400">
                    Loading...
                  </p>
                ) : data[section.key]?.length === 0 ? (
                  <p className="px-8 py-1.5 text-xs text-gray-400">
                    None found
                  </p>
                ) : (
                  data[section.key]?.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => onSelectItem(section.key, item)}
                      className={`w-full text-left px-8 py-1.5 text-sm truncate hover:bg-gray-50 ${
                        selectedId === item.id
                          ? "bg-blue-50 text-blue-700 font-medium"
                          : "text-gray-600"
                      }`}
                    >
                      <span className="block truncate">{item.name}</span>
                      {item.subtitle && (
                        <span className="block text-xs text-gray-400 truncate">
                          {item.subtitle}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        ))}
      </nav>
    </aside>
  );
}
