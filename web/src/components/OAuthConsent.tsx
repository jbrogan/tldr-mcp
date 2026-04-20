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
  | { kind: "submitting"; details: Details }
  | { kind: "handed-off"; approved: boolean; redirectUrl: string };

interface Props {
  authorizationId: string | null;
  onSignOut: () => void;
  userId: string;
  userEmail: string;
}

export function OAuthConsent({ authorizationId, onSignOut, userId, userEmail }: Props) {
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
        // Verify the signed-in user matches the user who initiated the OAuth flow.
        // If they signed in with a different account (e.g., wrong Google account),
        // reject immediately rather than silently swapping identity.
        const details = body as Details;
        if (details.user.id !== userId) {
          await supabase.auth.signOut();
          setState({
            kind: "error",
            message: `You authenticated as ${userEmail} but this authorization belongs to ${details.user.email}. Please sign in with the correct account.`,
          });
          return;
        }
        setState({ kind: "ready", details });
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
        setState({ kind: "handed-off", approved: approve, redirectUrl: body.redirect_url });
        // Kick off the hand-off. Custom URL schemes (e.g. claude://) leave the
        // tab on this page after the OS prompt, so we also render a "done" UI.
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

  if (state.kind === "handed-off") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-md p-8 space-y-4 text-center">
          <h1 className="text-xl font-bold text-gray-900">
            {state.approved ? "Authorized" : "Denied"}
          </h1>
          <p className="text-sm text-gray-500">
            {state.approved
              ? "You can return to the app that requested access. This tab can be closed."
              : "Access was denied. This tab can be closed."}
          </p>
          <a
            href={state.redirectUrl}
            className="text-xs text-blue-600 hover:text-blue-500"
          >
            If nothing happened, click here to continue.
          </a>
        </div>
      </div>
    );
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
