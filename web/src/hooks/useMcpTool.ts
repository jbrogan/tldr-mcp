import { useState, useCallback } from "react";
import { callTool, type ToolResult } from "../lib/mcp";

export function useMcpTool() {
  const [result, setResult] = useState<ToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const call = useCallback(
    async (name: string, args: Record<string, unknown> = {}) => {
      setLoading(true);
      setError(null);
      setResult(null);
      try {
        const res = await callTool(name, args);
        setResult(res);
        return res;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { call, result, loading, error };
}
