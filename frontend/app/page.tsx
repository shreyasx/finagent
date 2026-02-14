"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, User } from "lucide-react";
import ChatMessage from "@/components/ChatMessage";
import ThinkingCard from "@/components/ThinkingCard";
import type { ChatMessage as ChatMessageType } from "@/lib/websocket";
import { WebSocketClient } from "@/lib/websocket";

// Sample initial messages for demonstration
const sampleMessages: ChatMessageType[] = [
  {
    id: "1",
    role: "agent",
    content:
      "Hello! I'm FinAgent, your AI-powered financial document analyst. I can help you analyze invoices, find discrepancies, compare vendor payments, and generate reports. How can I help you today?",
    timestamp: new Date().toISOString(),
  },
];

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessageType[]>(sampleMessages);
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
    });

    ws.onStream((chunk) => {
      if (chunk.done) {
        setIsStreaming(false);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === chunk.message_id ? { ...m, streaming: false } : m
          )
        );
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
  }, []);

  const simulateResponse = useCallback(
    async (userMessage: string) => {
      setIsThinking(true);

      // Simulate thinking steps
      const steps = [
        { tool: "search_documents", status: "Searching documents..." },
        {
          tool: "search_documents",
          status: "Complete",
          result_summary: "Found 3 matching invoices from Acme Corp",
        },
        { tool: "calculate_totals", status: "Calculating totals..." },
        {
          tool: "calculate_totals",
          status: "Complete",
          result_summary: "Total: $45,230.00 across 3 invoices",
        },
      ];

      for (let i = 0; i < steps.length; i++) {
        await new Promise((r) => setTimeout(r, 600));
        setThinkingSteps((prev) => [...prev, steps[i]]);
      }

      await new Promise((r) => setTimeout(r, 400));
      setIsThinking(false);

      // Simulate streaming response
      setIsStreaming(true);
      const responseText = getSimulatedResponse(userMessage);
      const responseId = Date.now().toString();

      for (let i = 0; i < responseText.length; i += 3) {
        await new Promise((r) => setTimeout(r, 20));
        const chunk = responseText.slice(i, i + 3);

        setMessages((prev) => {
          const existing = prev.find((m) => m.id === responseId);
          if (existing) {
            return prev.map((m) =>
              m.id === responseId
                ? { ...m, content: m.content + chunk }
                : m
            );
          }
          return [
            ...prev,
            {
              id: responseId,
              role: "agent" as const,
              content: chunk,
              timestamp: new Date().toISOString(),
              streaming: true,
              citations: [
                {
                  text: "Invoice #1042",
                  document: "Q4_Invoice_Acme.pdf",
                  page: 2,
                },
                {
                  text: "Payment Record",
                  document: "Vendor_Payments_2024.xlsx",
                },
              ],
            },
          ];
        });
      }

      setIsStreaming(false);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === responseId ? { ...m, streaming: false } : m
        )
      );
      setThinkingSteps([]);
    },
    []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    const userMsg: ChatMessageType = {
      id: Date.now().toString(),
      role: "user",
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    // Try WebSocket first, fall back to simulation
    if (wsRef.current?.isConnected) {
      setIsThinking(true);
      wsRef.current.send(trimmed);
    } else {
      simulateResponse(trimmed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Chat header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-gray-900">FinAgent Chat</h1>
            <p className="text-xs text-gray-500">
              {wsStatus === "connected" ? (
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                  Connected
                </span>
              ) : wsStatus === "reconnecting" ? (
                <span className="text-yellow-500">Reconnecting...</span>
              ) : (
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                  Demo Mode
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className="flex items-start gap-3">
            {msg.role === "agent" && (
              <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-4 w-4 text-primary" />
              </div>
            )}
            <div className={`flex-1 ${msg.role === "user" ? "flex justify-end" : ""}`}>
              <ChatMessage message={msg} />
            </div>
            {msg.role === "user" && (
              <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-200">
                <User className="h-4 w-4 text-gray-600" />
              </div>
            )}
          </div>
        ))}

        {/* Thinking steps */}
        {(isThinking || thinkingSteps.length > 0) && (
          <div className="flex items-start gap-3">
            <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <ThinkingCard steps={thinkingSteps} isActive={isThinking} />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 bg-white px-6 py-4">
        <form onSubmit={handleSubmit} className="flex items-end gap-3">
          <div className="relative flex-1">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your financial documents..."
              rows={1}
              className="w-full resize-none rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 pr-12 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
              style={{ maxHeight: "120px" }}
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isStreaming || isThinking}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white transition-colors hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="h-5 w-5" />
          </button>
        </form>
        <p className="mt-2 text-center text-[10px] text-gray-400">
          FinAgent may produce inaccurate information. Always verify critical financial data.
        </p>
      </div>
    </div>
  );
}

function getSimulatedResponse(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes("invoice") || lower.includes("acme")) {
    return "I found 3 invoices from Acme Corp in your uploaded documents. The total amount across all invoices is $45,230.00. Here's a breakdown:\n\n- Invoice #1042: $18,500.00 (Oct 2024)\n- Invoice #1038: $15,730.00 (Sep 2024)\n- Invoice #1025: $11,000.00 (Aug 2024)\n\nAll invoices have been matched with corresponding payment records. No discrepancies were found between billed and paid amounts.";
  }
  if (lower.includes("discrepan") || lower.includes("error") || lower.includes("mismatch")) {
    return "I've identified 2 discrepancies in your financial documents:\n\n1. **Vendor Payment Mismatch**: Payment to GlobalTech Solutions shows $12,450 paid vs. $12,950 invoiced -- a difference of $500.00. This appears in the December 2024 cycle.\n\n2. **Duplicate Entry**: Invoice #2087 from DataFlow Inc. appears twice in the expense report with slightly different dates (Jan 3 vs Jan 5). The amount of $8,200 may have been double-counted.\n\nWould you like me to generate a detailed discrepancy report?";
  }
  if (lower.includes("report") || lower.includes("summary")) {
    return "I can generate several types of reports for you:\n\n1. **Financial Summary Report** -- Overview of all processed documents, totals, and key metrics\n2. **Discrepancy Report** -- Detailed list of all identified mismatches and anomalies\n3. **Vendor Analysis Report** -- Breakdown of payments by vendor with trend analysis\n\nWhich report would you like me to generate? I can export it as PDF or Excel.";
  }
  return "I've analyzed your query against the uploaded financial documents. Based on the data available, I can help you with invoice analysis, payment verification, discrepancy detection, and report generation.\n\nCould you provide more details about what you'd like me to look into? For example:\n- Search for specific invoices or vendors\n- Compare payment records against invoices\n- Identify potential discrepancies\n- Generate a financial summary report";
}
