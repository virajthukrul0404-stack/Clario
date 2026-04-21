"use client";

import { useState } from "react";
import type { SessionChatMessage } from "@/lib/socket";

type SessionSummaryTabProps = {
  sessionId: string;
  messages: SessionChatMessage[];
};

export default function SessionSummaryTab({
  sessionId,
  messages,
}: SessionSummaryTabProps) {
  const [summary, setSummary] = useState("");
  const [generating, setGenerating] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/ai/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          messages: messages.map(m => 
            `${m.senderName}: ${m.content}`)
        }),
      });
      const data = await res.json();
      setSummary(data.summary);
    } catch {
      setSummary("Failed to generate summary. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#fafafa] p-5">
      <h3 className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-widest mb-4 flex justify-between items-center">
        <span>AI Insights</span>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="bg-emerald-500 text-white px-3 py-1 rounded-full hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-[10px]"
        >
          {generating ? "Generating..." : "Generate"}
        </button>
      </h3>

      <div className="flex-1 overflow-y-auto w-full">
        {summary ? (
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
            {summary}
          </div>
        ) : (
          <div className="flex bg-white flex-col h-full items-center justify-center border border-dashed border-gray-300 rounded-xl p-6 text-center text-gray-400">
            <svg
              className="w-10 h-10 mb-3 opacity-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <p className="text-sm font-medium">{summary || "No Summary Generated"}</p>
            <p className="text-xs mt-1">Hit generate below to summarize the live chat.</p>
          </div>
        )}
      </div>
    </div>
  );
}
