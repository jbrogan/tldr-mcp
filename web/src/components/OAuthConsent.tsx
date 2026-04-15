import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const API_BASE = (import.meta.env.VITE_MCP_URL || "http://localhost:3000/mcp").replace(
  /\/mcp$/,
  "",
);

type Details = {
  authorization_id: string;
  redirect_uri: string;
  client: { id: string; name: string; uri: string; logo_uri: string };
  user: { id: string; email: string };
  scope: string;
};

async function authFetch(path: string, init?: RequestInit): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
}

type State =
  | { kind: "loading" }
  | { kind: "missing-id" }
  | { kind: "error"; message: string }
  | { kind: "ready"; details: Details }
  | { kind: "submitting"; details: Details };

interface Props {
  authorizationId: string | null;
  onSignOut: () => void;
  userEmail: string;
}

export function OAuthConsent({ authorizationId, onSignOut, userEmail }: Props) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!authorizationId) {
      setState({ kind: "missing-id" });
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const response = await authFetch(`/oauth/consent/${authorizationId}`);
        if (cancelled) return;
        const body = await response.json();
        if (!response.ok) {
          setState({ kind: "error", message: body?.error ?? `HTTP ${response.status}` });
          return;
        }
        if (body && "redirect_url" in body) {
          // Already consented — redirect immediately.
          window.location.href = body.redirect_url;
          return;
        }
        setState({ kind: "ready", details: body as Details });
      } catch (err) {
        if (!cancelled) {
          setState({ kind: "error", message: err instanceof Error ? err.message : "Request failed" });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authorizationId]);

  const decide = async (approve: boolean) => {
    if (!authorizationId || state.kind !== "ready") return;
    setState({ kind: "submitting", details: state.details });
    try {
      const response = await authFetch(`/oauth/consent/${authorizationId}`, {
        method: "POST",
        body: JSON.stringify({ action: approve ? "approve" : "deny" }),
      });
      const body = await response.json();
      if (!response.ok) {
        setState({ kind: "error", message: body?.error ?? `HTTP ${response.status}` });
        return;
      }
      if (body?.redirect_url) {
        window.location.href = body.redirect_url;
      }
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message : "Request failed" });
    }
  };

  if (state.kind === "loading") {
    return <Centered>Loading authorization…</Centered>;
  }

  if (state.kind === "missing-id") {
    return <Centered tone="error">Missing authorization_id in URL.</Centered>;
  }

  if (state.kind === "error") {
    return <Centered tone="error">{state.message}</Centered>;
  }

  const { details } = state;
  const scopes = details.scope.trim().split(/\s+/).filter(Boolean);
  const submitting = state.kind === "submitting";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-md p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Authorize access</h1>
          <p className="mt-1 text-sm text-gray-500">
            <span className="font-medium text-gray-900">{details.client.name}</span> wants to
            access your tldr account.
          </p>
        </div>

        <div className="text-sm text-gray-600 space-y-2">
          <div>
            <span className="text-gray-400">Signing in as:</span>{" "}
            <span className="font-medium text-gray-900">{userEmail}</span>
          </div>
          <div>
            <span className="text-gray-400">Will receive:</span>
            <ul className="mt-1 ml-4 list-disc text-gray-700">
              {scopes.length === 0 ? (
                <li>default access</li>
              ) : (
                scopes.map((s) => <li key={s}>{s}</li>)
              )}
            </ul>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            disabled={submitting}
            onClick={() => decide(false)}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
          >
            Deny
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => decide(true)}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
          >
            {submitting ? "Redirecting…" : "Approve"}
          </button>
        </div>

        <button
          type="button"
          onClick={onSignOut}
          className="w-full text-center text-xs text-gray-400 hover:text-gray-600"
        >
          Not you? Sign out.
        </button>
      </div>
    </div>
  );
}

function Centered({ children, tone }: { children: React.ReactNode; tone?: "error" }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className={tone === "error" ? "text-red-600 text-sm" : "text-gray-400 text-sm"}>
        {children}
      </p>
    </div>
  );
}
