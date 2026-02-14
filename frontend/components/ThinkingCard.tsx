"use client";

import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";

interface ThinkingStep {
  tool: string;
  status: string;
  result_summary?: string;
}

interface ThinkingCardProps {
  steps: ThinkingStep[];
  isActive?: boolean;
}

export default function ThinkingCard({ steps, isActive = false }: ThinkingCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const latestStep = steps[steps.length - 1];
  const headerText = isActive
    ? `${latestStep?.status || "Thinking"}...`
    : `Used ${steps.length} tool${steps.length !== 1 ? "s" : ""}`;

  return (
    <div className="my-2 max-w-[75%] animate-fade-in-up">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm text-gray-600 shadow-sm hover:bg-gray-50 transition-colors"
      >
        {isActive ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : (
          <div className="h-4 w-4 rounded-full bg-green-100 flex items-center justify-center">
            <div className="h-2 w-2 rounded-full bg-green-500" />
          </div>
        )}
        <span className="flex-1 font-medium">{headerText}</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {isExpanded && (
        <div className="mt-1 rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
          {steps.map((step, index) => (
            <div
              key={index}
              className="rounded-md bg-white p-2 border border-gray-100"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-semibold text-primary bg-blue-50 px-1.5 py-0.5 rounded">
                  {step.tool}
                </span>
                <span className="text-xs text-gray-500">{step.status}</span>
              </div>
              {step.result_summary && (
                <p className="mt-1 text-xs text-gray-600 leading-relaxed">
                  {step.result_summary}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
