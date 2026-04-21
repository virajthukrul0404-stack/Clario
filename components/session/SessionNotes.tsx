"use client";

import { useEffect, useState } from "react";

type SessionNotesProps = {
  content: string;
  onContentChange: (content: string) => void;
};

export default function SessionNotes({
  content,
  onContentChange,
}: SessionNotesProps) {
  const [localContent, setLocalContent] = useState(content);

  useEffect(() => {
    setLocalContent(content);
  }, [content]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setLocalContent(newContent);
    onContentChange(newContent);
  };

  return (
    <div className="flex flex-col h-full bg-[#fafafa] p-5">
      <h3 className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-widest mb-4">
        Collaborative Notes
      </h3>
      <textarea
        value={localContent}
        onChange={handleChange}
        placeholder="Type shared notes here..."
        className="flex-1 w-full bg-white rounded-xl border border-gray-200 p-4 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#4ade80]/50 resize-none shadow-sm"
      />
    </div>
  );
}
