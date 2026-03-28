import { useState, useCallback } from "react";
import { callTool } from "../lib/mcp";

interface SidebarItem {
  id: string;
  name: string;
  subtitle?: string;
}

interface SidebarSection {
  key: string;
  label: string;
  tool?: string;
  args?: Record<string, unknown>;
  parse?: (text: string) => SidebarItem[];
  staticItems?: SidebarItem[];
}

interface SidebarProps {
  onSelectItem: (section: string, item: SidebarItem) => void;
  selectedId?: string;
}

/** Parse lines like "  Name (uuid)" or "  Name (uuid) - extra" */
function parseNameIdLines(text: string): SidebarItem[] {
  const items: SidebarItem[] = [];
  for (const line of text.split("\n")) {
    const match = line.match(/^\s+(.+?)\s+\(([0-9a-f-]{36})\)(.*)$/i);
    if (match) {
      items.push({
        id: match[2],
        name: match[1].trim(),
        subtitle: match[3].replace(/^\s*-\s*/, "").trim() || undefined,
      });
    }
  }
  return items;
}

/** Parse people with multi-line details */
function parsePeople(text: string): SidebarItem[] {
  const items: SidebarItem[] = [];
  const blocks = text.split("\n\n");
  for (const block of blocks) {
    const match = block.match(/(.+?)\s+\(([0-9a-f-]{36})\)/i);
    if (match) {
      const relMatch = block.match(/Relationship:\s*(\w+)/);
      items.push({
        id: match[2],
        name: match[1].trim(),
        subtitle: relMatch?.[1],
      });
    }
  }
  return items;
}

/** Parse lines like "  Name (uuid) → serves: X — shared by Y" */
function parseSharedLines(text: string): SidebarItem[] {
  const items: SidebarItem[] = [];
  for (const line of text.split("\n")) {
    const match = line.match(/^\s+(.+?)\s+\(([0-9a-f-]{36})\)(.*)$/i);
    if (match) {
      const sharedBy = match[3].match(/shared by\s+(.+)/i);
      items.push({
        id: match[2],
        name: match[1].trim(),
        subtitle: sharedBy ? `by ${sharedBy[1].trim()}` : undefined,
      });
    }
  }
  return items;
}

const sections: SidebarSection[] = [
  {
    key: "areas",
    label: "Areas",
    tool: "list_areas",
    parse: parseNameIdLines,
  },
  {
    key: "beliefs",
    label: "Beliefs",
    tool: "list_beliefs",
    parse: parseNameIdLines,
  },
  {
    key: "ends",
    label: "Ends",
    tool: "list_ends",
    parse: parseNameIdLines,
  },
  {
    key: "habits",
    label: "Habits",
    tool: "list_habits",
    parse: parseNameIdLines,
  },
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
  {
    key: "tasks",
    label: "Tasks",
    tool: "list_tasks",
    parse: parseNameIdLines,
  },
  {
    key: "organizations",
    label: "Organizations",
    tool: "list_organizations",
    args: { expand: false },
    parse: parseNameIdLines,
  },
  {
    key: "teams",
    label: "Teams",
    tool: "list_teams",
    parse: parseNameIdLines,
  },
  {
    key: "people",
    label: "People",
    tool: "list_people",
    parse: parsePeople,
  },
  {
    key: "collections",
    label: "Collections",
    tool: "list_collections",
    parse: parseNameIdLines,
  },
  {
    key: "my_shares",
    label: "My Shares",
    tool: "list_my_shares",
    parse: parseSharedLines,
  },
  {
    key: "shared_ends",
    label: "Shared Ends",
    tool: "list_shared_ends",
    parse: parseSharedLines,
  },
  {
    key: "shared_habits",
    label: "Shared Habits",
    tool: "list_shared_habits",
    parse: parseSharedLines,
  },
];

export function Sidebar({ onSelectItem, selectedId }: SidebarProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [data, setData] = useState<Record<string, SidebarItem[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const toggleSection = useCallback(
    async (section: SidebarSection) => {
      const isOpen = expanded[section.key];
      setExpanded((prev) => ({ ...prev, [section.key]: !isOpen }));

      // Load data on first expand
      if (!isOpen && !data[section.key]) {
        if (section.staticItems) {
          setData((prev) => ({ ...prev, [section.key]: section.staticItems! }));
          return;
        }
        setLoading((prev) => ({ ...prev, [section.key]: true }));
        try {
          const result = await callTool(section.tool!, section.args ?? {});
          const items = section.parse!(result.text);
          setData((prev) => ({ ...prev, [section.key]: items }));
        } catch {
          setData((prev) => ({ ...prev, [section.key]: [] }));
        } finally {
          setLoading((prev) => ({ ...prev, [section.key]: false }));
        }
      }
    },
    [expanded, data]
  );

  const refreshSection = useCallback(
    async (section: SidebarSection) => {
      if (!section.tool || !section.parse) return;
      setLoading((prev) => ({ ...prev, [section.key]: true }));
      try {
        const result = await callTool(section.tool, section.args ?? {});
        const items = section.parse(result.text);
        setData((prev) => ({ ...prev, [section.key]: items }));
      } catch {
        setData((prev) => ({ ...prev, [section.key]: [] }));
      } finally {
        setLoading((prev) => ({ ...prev, [section.key]: false }));
      }
    },
    []
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
                    refreshSection(section);
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
