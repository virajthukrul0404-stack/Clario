"use client";

import { useState } from "react";
import type { SharedResource } from "@/lib/socket";

type SessionResourcesProps = {
  resources: SharedResource[];
  onAddResource: (resource: SharedResource) => void;
  currentUserName: string;
};

export default function SessionResources({
  resources,
  onAddResource,
  currentUserName,
}: SessionResourcesProps) {
  const [urlInput, setUrlInput] = useState("");
  const [titleInput, setTitleInput] = useState("");

  const handleAdd = () => {
    if (!urlInput.trim()) return;

    const resource: SharedResource = {
      id: Math.random().toString(36).slice(2),
      url: urlInput.trim(),
      title: titleInput.trim() || urlInput.trim().split("?")[0].slice(-30),
      addedBy: currentUserName,
    };

    onAddResource(resource);
    setUrlInput("");
    setTitleInput("");
  };

  return (
    <div className="flex flex-col h-full bg-[#fafafa] p-5">
      <h3 className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-widest mb-4">
        Shared Resources
      </h3>

      <div className="flex-1 overflow-y-auto space-y-3 mb-4">
        {resources.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No resources added yet.</p>
        ) : (
          resources.map((res) => (
            <div
              key={res.id}
              className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-1"
            >
              <a
                href={res.url.startsWith("http") ? res.url : `https://${res.url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-[#111111] hover:text-[#4ade80] transition-colors"
              >
                {res.title}
              </a>
              <span className="text-[11px] text-gray-400">Added by {res.addedBy}</span>
            </div>
          ))
        )}
      </div>

      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-2">
        <input
          placeholder="Resource Title (optional)"
          value={titleInput}
          onChange={(e) => setTitleInput(e.target.value)}
          className="w-full text-sm rounded bg-[#f5f5f5] px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#e5e5e5]"
        />
        <input
          placeholder="Paste URL here..."
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          className="w-full text-sm rounded bg-[#f5f5f5] px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#e5e5e5]"
        />
        <button
          onClick={handleAdd}
          disabled={!urlInput.trim()}
          className="mt-2 w-full bg-[#111] text-white py-2 rounded-full text-sm font-medium hover:bg-[#222] disabled:opacity-50 transition-colors"
        >
          Share Link
        </button>
      </div>
    </div>
  );
}
