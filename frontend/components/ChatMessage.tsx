"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FileText } from "lucide-react";
import type { ChatMessage as ChatMessageType } from "@/lib/websocket";

interface ChatMessageProps {
  message: ChatMessageType;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex animate-fade-in-up ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-neutral-900 text-white rounded-br-md"
            : "bg-neutral-100 text-neutral-900 rounded-bl-md"
        }`}
      >
        {isUser ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
        ) : (
          <div
            className={`prose prose-sm max-w-none prose-p:leading-relaxed prose-headings:mt-3 prose-headings:mb-1 prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-table:my-2 prose-th:px-2 prose-th:py-1 prose-td:px-2 prose-td:py-1 prose-th:border prose-td:border prose-th:border-neutral-300 prose-td:border-neutral-300 prose-strong:text-neutral-900 ${
              message.streaming ? "streaming-cursor" : ""
            }`}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {message.citations && message.citations.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.citations.map((citation, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 rounded-full bg-neutral-200 px-2.5 py-0.5 text-xs font-medium text-neutral-700 cursor-pointer hover:bg-neutral-300 transition-colors"
                title={`${citation.document}${citation.page ? ` - Page ${citation.page}` : ""}`}
              >
                <FileText className="h-3 w-3" />
                {citation.text}
              </span>
            ))}
          </div>
        )}

        <p
          className={`mt-1 text-[10px] ${
            isUser ? "text-neutral-400" : "text-neutral-400"
          }`}
        >
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}
