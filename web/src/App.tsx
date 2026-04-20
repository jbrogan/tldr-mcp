import { useEffect, useState, useRef } from "react";
import { useAuth } from "./hooks/useAuth";
import { Login } from "./components/Login";
import { Chat } from "./components/Chat";
import { Sidebar } from "./components/Sidebar";
import { DetailPanel } from "./components/DetailPanel";
import { OAuthConsent } from "./components/OAuthConsent";
import { connect, disconnect } from "./lib/mcp";
import { supabase } from "./lib/supabase";

function App() {
  const { session, loading, signIn, signUp, signOut, signInWithGoogle } = useAuth();
  const [mcpReady, setMcpReady] = useState(false);
  const [mcpError, setMcpError] = useState<string | null>(null);
  const connectingRef = useRef(false);

  const isConsentPage =
    typeof window !== "undefined" && window.location.pathname === "/oauth/consent";

  useEffect(() => {
    // Consent page is a standalone flow — no MCP connection needed.
    if (isConsentPage) {
      disconnect();
      setMcpReady(false);
      return;
    }
    if (!session?.access_token) {
      disconnect();
      setMcpReady(false);
      return;
    }

    let cancelled = false;

    async function init() {
      // Prevent double-connect from StrictMode
      if (connectingRef.current) return;
      connectingRef.current = true;

      try {
        // Auto-detect and update timezone on login
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz) {
          supabase.from("profiles").update({ timezone: tz }).eq("id", session!.user.id).then(() => {});
        }

        await connect(async () => {
          const { data } = await supabase.auth.getSession();
          return data.session?.access_token ?? session!.access_token;
        });
        if (!cancelled) {
          setMcpReady(true);
          setMcpError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setMcpError(err instanceof Error ? err.message : "Failed to connect");
          setMcpReady(false);
        }
      } finally {
        connectingRef.current = false;
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [session?.access_token, isConsentPage]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  if (isConsentPage) {
    // Force a fresh login on every consent flow. If the user has an existing
    // session (e.g., signed into the web app as a different account), sign them
    // out so they explicitly authenticate as the account they intend to authorize.
    // The sessionStorage flag prevents a sign-out loop: set before signing out,
    // cleared after the user completes a fresh sign-in.
    const consentAuthKey = "oauth_consent_fresh_auth";
    if (session && !sessionStorage.getItem(consentAuthKey)) {
      sessionStorage.setItem(consentAuthKey, "pending");
      supabase.auth.signOut();
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <p className="text-gray-400">Preparing sign-in...</p>
        </div>
      );
    }
    if (!session) {
      return (
        <Login
          onSignIn={async (email, password) => {
            await signIn(email, password);
            sessionStorage.setItem(consentAuthKey, "done");
          }}
          onSignUp={async (email, password) => {
            await signUp(email, password);
            sessionStorage.setItem(consentAuthKey, "done");
          }}
          onGoogleSignIn={async () => {
            sessionStorage.setItem(consentAuthKey, "done");
            await signInWithGoogle();
          }}
        />
      );
    }
    // Fresh auth completed — clear the flag for any future consent flows in this tab.
    if (sessionStorage.getItem(consentAuthKey) === "pending") {
      // Session appeared without going through our wrapped login handlers
      // (e.g., Supabase restored a session from a cookie after the sign-out).
      // Sign out again to force explicit authentication.
      supabase.auth.signOut();
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <p className="text-gray-400">Preparing sign-in...</p>
        </div>
      );
    }
    const authorizationId = new URLSearchParams(window.location.search).get("authorization_id");
    return (
      <OAuthConsent
        authorizationId={authorizationId}
        onSignOut={signOut}
        userId={session.user.id}
        userEmail={session.user.email ?? ""}
      />
    );
  }

  if (!session) {
    return (
      <Login
        onSignIn={signIn}
        onSignUp={signUp}
        onGoogleSignIn={signInWithGoogle}
      />
    );
  }

  if (mcpError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-3">
          <p className="text-red-600 text-sm">Failed to connect to server</p>
          <p className="text-gray-400 text-xs">{mcpError}</p>
          <button
            onClick={async () => {
              setMcpError(null);
              try {
                await connect(async () => {
                  const { data } = await supabase.auth.getSession();
                  return data.session?.access_token ?? session.access_token;
                });
                setMcpReady(true);
              } catch (err) {
                setMcpError(
                  err instanceof Error ? err.message : "Failed to connect"
                );
              }
            }}
            className="text-sm text-blue-600 hover:text-blue-500"
          >
            Retry
          </button>
          <button
            onClick={signOut}
            className="text-sm text-gray-500 hover:text-gray-700 block mx-auto"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  if (!mcpReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400">Connecting...</p>
      </div>
    );
  }

  return (
    <AppLayout
      onSignOut={signOut}
      userEmail={session.user.email ?? ""}
    />
  );
}

function AppLayout({ onSignOut, userEmail }: { onSignOut: () => void; userEmail: string }) {
  const [selectedItem, setSelectedItem] = useState<{
    section: string;
    id: string;
    name: string;
  } | null>(null);

  return (
    <div className="flex h-screen">
      <Sidebar
        onSelectItem={(section, item) =>
          setSelectedItem({ section, id: item.id, name: item.name })
        }
        selectedId={selectedItem?.id}
      />
      {selectedItem && (
        <DetailPanel
          section={selectedItem.section}
          itemId={selectedItem.id}
          itemName={selectedItem.name}
          onClose={() => setSelectedItem(null)}
        />
      )}
      <div className="flex-1 min-w-0">
        <Chat onSignOut={onSignOut} userEmail={userEmail} />
      </div>
    </div>
  );
}

export default App;
