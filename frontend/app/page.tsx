"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send } from "lucide-react";
import ChatMessage from "@/components/ChatMessage";
import ThinkingCard from "@/components/ThinkingCard";
import { useAuth } from "@/components/AuthProvider";
import type { ChatMessage as ChatMessageType } from "@/lib/websocket";
import { WebSocketClient } from "@/lib/websocket";

const SESSION_KEY = "finagent_chat";

const welcomeMessage: ChatMessageType = {
  id: "welcome",
  role: "agent",
  content:
    "Hello! I'm FinAgent, your AI-powered financial document analyst. I can help you analyze invoices, find discrepancies, compare vendor payments, and generate reports. How can I help you today?",
  timestamp: new Date().toISOString(),
};

function loadMessages(): ChatMessageType[] {
  if (typeof window === "undefined") return [welcomeMessage];
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore
  }
  return [welcomeMessage];
}

function saveMessages(messages: ChatMessageType[]) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(messages));
  } catch {
    // ignore
  }
}

export default function ChatPage() {
  const { user, refreshUser } = useAuth();
  const [messages, setMessages] = useState<ChatMessageType[]>(loadMessages);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [thinkingSteps, setThinkingSteps] = useState<
    { tool: string; status: string; result_summary?: string }[]
  >([]);
  const [isThinking, setIsThinking] = useState(false);
  const [wsStatus, setWsStatus] = useState<
    "connected" | "disconnected" | "reconnecting"
  >("disconnected");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const wsRef = useRef<WebSocketClient | null>(null);

  const isOverLimit = user
    ? user.interaction_count >= user.max_interactions
    : false;

  // Save messages to sessionStorage on change
  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinkingSteps]);

  // WebSocket connection
  useEffect(() => {
    const ws = new WebSocketClient();
    wsRef.current = ws;

    ws.onStatus((status) => setWsStatus(status));

    ws.onThinking((step) => {
      setIsThinking(true);
      setThinkingSteps((prev) => [
        ...prev,
        { tool: step.tool, status: step.content },
      ]);
    });

    ws.onMessage((msg) => {
      setMessages((prev) => [...prev, msg]);
      setIsStreaming(false);
      setIsThinking(false);
      setThinkingSteps([]);
      refreshUser();
    });

    ws.onStream((chunk) => {
      if (chunk.done) {
        setIsStreaming(false);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === chunk.message_id ? { ...m, streaming: false } : m
          )
        );
        refreshUser();
        return;
      }

      setMessages((prev) => {
        const existing = prev.find((m) => m.id === chunk.message_id);
        if (existing) {
          return prev.map((m) =>
            m.id === chunk.message_id
              ? { ...m, content: m.content + chunk.content }
              : m
          );
        }
        return [
          ...prev,
          {
            id: chunk.message_id,
            role: "agent" as const,
            content: chunk.content,
            timestamp: new Date().toISOString(),
            streaming: true,
          },
        ];
      });
    });

    ws.connect();

    return () => ws.disconnect();
  }, [refreshUser]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed || isStreaming || isThinking || isOverLimit) return;

      const userMsg: ChatMessageType = {
        id: Date.now().toString(),
        role: "user",
        content: trimmed,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");

      if (wsRef.current?.isConnected) {
        setIsThinking(true);
        wsRef.current.send(trimmed);
      }
    },
    [input, isStreaming, isThinking, isOverLimit]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="mx-auto flex h-full w-full max-w-2xl flex-col">
      {/* Chat header */}
      <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-3">
        <div>
          <h1 className="text-sm font-semibold text-neutral-900">Chat</h1>
          <p className="text-xs text-neutral-400">
            {wsStatus === "connected" ? (
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-neutral-900" />
                Connected
              </span>
            ) : wsStatus === "reconnecting" ? (
              <span>Reconnecting...</span>
            ) : (
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-neutral-300" />
                Disconnected
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className="flex items-start gap-3">
            {msg.role === "agent" && (
              <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-100">
                <span className="text-xs font-bold text-neutral-900">F</span>
              </div>
            )}
            <div className={`flex-1 ${msg.role === "user" ? "flex justify-end" : ""}`}>
              <ChatMessage message={msg} />
            </div>
            {msg.role === "user" && (
              <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-900">
                <span className="text-xs font-bold text-white">U</span>
              </div>
            )}
          </div>
        ))}

        {(isThinking || thinkingSteps.length > 0) && (
          <div className="flex items-start gap-3">
            <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-100">
              <span className="text-xs font-bold text-neutral-900">F</span>
            </div>
            <ThinkingCard steps={thinkingSteps} isActive={isThinking} />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-neutral-200 bg-white px-6 py-4">
        {isOverLimit ? (
          <div className="rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-center text-sm text-neutral-500">
            You have used all {user?.max_interactions} interactions.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex items-end gap-3">
            <div className="relative flex-1">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your financial documents..."
                rows={1}
                className="w-full resize-none rounded-xl border border-neutral-300 bg-neutral-50 px-4 py-3 pr-12 text-sm text-neutral-900 placeholder-neutral-400 focus:border-neutral-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
                style={{ maxHeight: "120px" }}
              />
            </div>
            <button
              type="submit"
              disabled={!input.trim() || isStreaming || isThinking}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-900 text-white transition-colors hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="h-5 w-5" />
            </button>
          </form>
        )}
        <p className="mt-2 text-center text-[10px] text-neutral-400">
          FinAgent may produce inaccurate information. Always verify critical financial data.
        </p>
      </div>
      </div>
    </div>
  );
}
