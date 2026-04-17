import { useState, useRef, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Settings } from "./Settings";

const API_BASE = (import.meta.env.VITE_MCP_URL || "http://localhost:3000/mcp").replace(
  /\/mcp$/,
  "",
);

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
  isError?: boolean;
}

interface ChatProps {
  onSignOut: () => void;
  userEmail: string;
}

export function Chat({ onSignOut, userEmail }: ChatProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  let nextId = useRef(0);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!loading) inputRef.current?.focus();
  }, [loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { id: nextId.current++, role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });
      const body = await res.json();
      const assistantMsg: Message = {
        id: nextId.current++,
        role: "assistant",
        text: res.ok ? body.response : body.error ?? "Something went wrong.",
        isError: !res.ok,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId.current++,
          role: "assistant",
          text: err instanceof Error ? err.message : "Request failed.",
          isError: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <h1 className="text-lg font-semibold text-gray-900">tldr</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{userEmail}</span>
          <button
            onClick={() => setShowSettings(true)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Settings
          </button>
          <button
            onClick={onSignOut}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Sign Out
          </button>
        </div>
      </header>
      {showSettings && <Settings onClose={() => setShowSettings(false)} userEmail={userEmail} />}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 mt-32">
              <p className="text-lg">Welcome! Just tell me what you've been doing.</p>
              <p className="text-sm mt-2">
                For example: "I went to the gym for 30 minutes" or "I practiced guitar today"
              </p>
              <p className="text-sm mt-3 text-gray-350">
                Type <span className="font-medium text-gray-500">help</span> for an overview of the system, or{" "}
                <span className="font-medium text-gray-500">help [topic]</span> to learn about a specific concept
                (e.g. "help beliefs", "help habits").
              </p>
            </div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-lg rounded-xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : msg.isError
                      ? "bg-red-50 text-red-700 border border-red-200"
                      : "bg-white text-gray-900 border border-gray-200"
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-400">
                Thinking...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 bg-white px-4 py-3">
        <form onSubmit={handleSubmit} className="mx-auto max-w-2xl flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tell me what you did today..."
            disabled={loading}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
