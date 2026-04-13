import { useState, useEffect } from "react";
import { callTool } from "../lib/mcp";

interface DetailPanelProps {
  section: string;
  itemId: string;
  itemName: string;
  onClose: () => void;
}

function getDateRanges(): Record<string, { fromDate: string; toDate: string }> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return {
    today: { fromDate: today, toDate: today },
    yesterday: { fromDate: yesterday, toDate: yesterday },
    this_week: { fromDate: monday.toISOString().slice(0, 10), toDate: sunday.toISOString().slice(0, 10) },
    this_month: { fromDate: firstOfMonth, toDate: lastOfMonth },
  };
}

function getDetailConfig(section: string, itemId: string, _itemName: string) {
  switch (section) {
    case "actions":
      return { tool: "list_actions", args: getDateRanges()[itemId] ?? {} };
    case "task_time":
      return { tool: "list_task_time", args: getDateRanges()[itemId] ?? {} };
    case "beliefs":
      return { tool: "get_belief", args: { id: itemId } };
    case "areas":
      return { tool: "list_ends", args: { areaId: itemId } };
    case "ends":
      return { tool: "get_end", args: { id: itemId } };
    case "habits":
      return { tool: "get_habit", args: { id: itemId } };
    case "people":
      return { tool: "get_person", args: { id: itemId } };
    case "organizations":
      return { tool: "list_teams", args: { organizationId: itemId } };
    case "tasks_open":
      return { tool: "get_task", args: { id: itemId } };
    case "tasks_completed":
      return { tool: "list_tasks", args: { completed: true } };
    case "teams":
      return { tool: "list_people", args: { teamId: itemId } };
    case "portfolios":
      return { tool: "list_ends", args: { portfolioId: itemId } };
    case "my_shares":
      return { tool: "get_end", args: { id: itemId } };
    case "shared_ends":
      return { tool: "get_end", args: { id: itemId } };
    case "shared_habits":
      return { tool: "get_habit", args: { id: itemId } };
    default:
      return null;
  }
}

export function DetailPanel({ section, itemId, itemName, onClose }: DetailPanelProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setContent(null);

    const config = getDetailConfig(section, itemId, itemName);
    if (!config) {
      setError("Unknown section");
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const result = await callTool(config.tool, config.args);
        if (!cancelled) {
          setContent(result.text);
          if (result.isError) setError(result.text);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load details");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [section, itemId, itemName]);

  return (
    <div className="w-96 h-screen flex flex-col bg-white border-r border-gray-200">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900 truncate">
          {itemName}
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-lg leading-none"
        >
          &times;
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
            {content}
          </pre>
        )}
      </div>
    </div>
  );
}
