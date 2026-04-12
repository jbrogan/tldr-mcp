import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const API_BASE = (import.meta.env.VITE_MCP_URL || "http://localhost:3000/mcp").replace(/\/mcp$/, "");

interface ApiToken {
  id: string;
  name: string;
  lastFour: string;
  expiresAt: string;
  lastUsedAt?: string;
  createdAt: string;
}

interface SettingsProps {
  onClose: () => void;
  userEmail: string;
}

async function authFetch(path: string, init?: RequestInit) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
}

export function Settings({ onClose, userEmail }: SettingsProps) {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTokenName, setNewTokenName] = useState("");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function loadTokens() {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/tokens");
      if (!res.ok) throw new Error("Failed to load tokens");
      const data = await res.json();
      setTokens(data.tokens ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tokens");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTokens();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTokenName.trim()) return;
    try {
      const res = await authFetch("/api/tokens", {
        method: "POST",
        body: JSON.stringify({ name: newTokenName.trim() }),
      });
      if (!res.ok) throw new Error("Failed to create token");
      const data = await res.json();
      setCreatedToken(data.token.token);
      setShowCreate(false);
      setNewTokenName("");
      await loadTokens();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create token");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Revoke this token? Any clients using it will stop working.")) return;
    try {
      const res = await authFetch(`/api/tokens/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete token");
      await loadTokens();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete token");
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const mcpServerUrl = (import.meta.env.VITE_MCP_URL || "http://localhost:3000/mcp");

  const claudeDesktopConfig = createdToken
    ? JSON.stringify(
        {
          mcpServers: {
            tldr: {
              command: "npx",
              args: ["mcp-remote@latest", mcpServerUrl, "--header", "Authorization: Bearer ${TLDR_MCP_TOKEN}"],
              env: { TLDR_MCP_TOKEN: createdToken },
            },
          },
        },
        null,
        2
      )
    : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Profile */}
          <section>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Profile</h3>
            <div className="text-sm text-gray-700">{userEmail}</div>
          </section>

          {/* Timezone */}
          <section>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Timezone</h3>
            <div className="text-sm text-gray-700">
              {Intl.DateTimeFormat().resolvedOptions().timeZone}
              <span className="text-xs text-gray-400 ml-2">(auto-detected from browser)</span>
            </div>
          </section>

          {/* API Tokens */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">API Tokens</h3>
                <p className="text-xs text-gray-400 mt-1">For Claude Desktop, scripts, and other MCP clients</p>
              </div>
              {!showCreate && !createdToken && (
                <button
                  onClick={() => setShowCreate(true)}
                  className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Create Token
                </button>
              )}
            </div>

            {error && <p className="text-red-600 text-sm mb-2">{error}</p>}

            {createdToken && claudeDesktopConfig && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-4">
                <p className="text-sm font-medium text-yellow-900 mb-2">
                  Save this token — it won't be shown again
                </p>
                <div className="bg-white rounded border border-yellow-300 p-2 mb-3 flex items-center justify-between gap-2">
                  <code className="text-xs break-all text-gray-700">{createdToken}</code>
                  <button
                    onClick={() => copyToClipboard(createdToken)}
                    className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 whitespace-nowrap"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <details>
                  <summary className="text-xs text-yellow-900 cursor-pointer">Claude Desktop config</summary>
                  <pre className="text-xs bg-white rounded border border-yellow-300 p-2 mt-2 overflow-x-auto">
                    {claudeDesktopConfig}
                  </pre>
                  <button
                    onClick={() => copyToClipboard(claudeDesktopConfig)}
                    className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 mt-2"
                  >
                    Copy config
                  </button>
                </details>
                <button
                  onClick={() => setCreatedToken(null)}
                  className="text-xs text-yellow-900 underline mt-3 block"
                >
                  I've saved it — dismiss
                </button>
              </div>
            )}

            {showCreate && (
              <form onSubmit={handleCreate} className="bg-gray-50 rounded p-3 mb-4 space-y-2">
                <input
                  type="text"
                  value={newTokenName}
                  onChange={(e) => setNewTokenName(e.target.value)}
                  placeholder="Token name (e.g. 'My laptop Claude Desktop')"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button type="submit" className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700">
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowCreate(false); setNewTokenName(""); }}
                    className="text-sm px-3 py-1.5 text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {loading ? (
              <p className="text-sm text-gray-400">Loading...</p>
            ) : tokens.length === 0 ? (
              <p className="text-sm text-gray-400">No tokens yet.</p>
            ) : (
              <ul className="space-y-2">
                {tokens.map((t) => (
                  <li key={t.id} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{t.name}</div>
                      <div className="text-xs text-gray-500">
                        ending in ...{t.lastFour} · expires {new Date(t.expiresAt).toLocaleDateString()}
                        {t.lastUsedAt && ` · last used ${new Date(t.lastUsedAt).toLocaleDateString()}`}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="text-xs px-2 py-1 text-red-600 hover:text-red-800"
                    >
                      Revoke
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
