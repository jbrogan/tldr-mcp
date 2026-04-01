import { useEffect, useState, useRef } from "react";
import { useAuth } from "./hooks/useAuth";
import { Login } from "./components/Login";
import { Chat } from "./components/Chat";
import { Sidebar } from "./components/Sidebar";
import { DetailPanel } from "./components/DetailPanel";
import { connect, disconnect } from "./lib/mcp";
import { supabase } from "./lib/supabase";

function App() {
  const { session, loading, signIn, signUp, signOut, signInWithGoogle } = useAuth();
  const [mcpReady, setMcpReady] = useState(false);
  const [mcpError, setMcpError] = useState<string | null>(null);
  const connectingRef = useRef(false);

  useEffect(() => {
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
  }, [session?.access_token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400">Loading...</p>
      </div>
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
