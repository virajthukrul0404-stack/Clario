/* Post-session summary — a thoughtful letter after a meaningful conversation. */
"use client";

export const dynamic = 'force-dynamic';
import React, { useState } from "react";
import { motion } from "framer-motion";
import { ProfileAvatar } from "@/components/ui/ProfileAvatar";
import { SketchButton } from "@/components/ui/SketchButton";
import { SketchCard } from "@/components/ui/SketchCard";
import { SketchDivider } from "@/components/ui/SketchDivider";
import Link from "next/link";

const SESSION = {
  teacher: "Maya Krishnan",
  date: "Apr 12, 2026",
  duration: "60 min",
};

const COVERED = [
  "Reviewed the difference between margin and markup in SaaS pricing",
  "Walked through how to position a mid-market product differently from self-serve",
  "Identified three assumptions in the current pricing model worth testing",
  "Discussed when to raise prices vs introduce a new tier",
];

const ACTIONS = [
  { id: "1", task: "Reprice the three main tiers using the margin formula" },
  { id: "2", task: "Write one paragraph positioning statement for each segment" },
  { id: "3", task: "Research how three competitors structure their pricing pages" },
  { id: "4", task: "Read the article Maya shared on value-based pricing" },
];

const THOUGHT = "You mentioned wanting to understand value-based pricing more deeply. Before our next session, try pricing one of your tiers based purely on the outcome it delivers — not the features it includes. Compare that number to your current price. The gap will tell you something useful about how you're currently thinking about your product's worth.";

function ActionItem({ task }: { task: string }) {
  const [checked, setChecked] = useState(false);

  return (
    <div className="flex gap-3 items-start py-2">
      <button onClick={() => setChecked(!checked)} className="mt-0.5 flex-shrink-0">
        <svg viewBox="0 0 20 20" className="w-4 h-4 text-ink">
          <rect x="1" y="1" width="18" height="18" rx="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
          {checked && (
            <motion.path
              d="M 5 10 L 8 14 L 15 5"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.3 }}
            />
          )}
        </svg>
      </button>
      <span className={`text-[15px] leading-relaxed transition-all duration-200 ${checked ? "line-through text-ink-faint" : "text-ink"}`}>
        {task}
      </span>
    </div>
  );
}

export default function SummaryPage() {
  const fadeUp = {
    initial: { y: 20, opacity: 0 },
    whileInView: { y: 0, opacity: 1 },
    viewport: { once: true, amount: 0.15 },
    transition: { duration: 0.6, ease: "easeOut" as const },
  };

  return (
    <div className="w-full max-w-[760px] mx-auto px-6 py-12 pb-24">
      {/* Heading */}
      <motion.div {...fadeUp}>
        <h1 className="text-[40px] font-bold text-ink leading-tight">
          Session{" "}
          <span className="font-hand inline-block" style={{ transform: "rotate(-1.5deg)" }}>
            complete
          </span>
        </h1>

        {/* Session strip */}
        <div className="flex items-center gap-3 mt-5">
          <ProfileAvatar seed={SESSION.teacher} size={32} />
          <span className="text-[15px] font-bold text-ink">{SESSION.teacher}</span>
          <span className="text-[14px] text-ink-muted">· {SESSION.date}</span>
          <span className="text-[12px] text-ink-muted px-2 py-0.5 relative">
            {SESSION.duration}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 60 24">
              <path d="M 3 3 C 15 1, 45 2, 57 4 C 58 8, 58 16, 56 21 C 45 23, 15 22, 3 20 C 2 16, 2 8, 3 3" fill="none" stroke="currentColor" strokeWidth="0.8" className="text-ink/[0.1]" vectorEffect="non-scaling-stroke" />
            </svg>
          </span>
        </div>
      </motion.div>

      <SketchDivider className="my-10" />

      {/* What you covered */}
      <motion.section {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.1 }}>
        <h2 className="text-[18px] font-bold text-ink mb-6">What you covered</h2>
        <div className="flex flex-col gap-5">
          {COVERED.map((item, i) => (
            <div key={i} className="flex gap-4 items-start">
              <svg viewBox="0 0 8 8" className="w-2 h-2 text-ink mt-2 flex-shrink-0">
                <circle cx="4" cy="4" r="3" fill="none" stroke="currentColor" strokeWidth="1.2" />
              </svg>
              <p className="text-[15px] text-ink leading-relaxed">{item}</p>
            </div>
          ))}
        </div>
      </motion.section>

      <SketchDivider className="my-10" />

      {/* Action items */}
      <motion.section {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.2 }}>
        <h2 className="text-[18px] font-bold text-ink mb-6">Your action items</h2>
        <div className="flex flex-col">
          {ACTIONS.map((a) => (
            <ActionItem key={a.id} task={a.task} />
          ))}
        </div>
      </motion.section>

      <SketchDivider className="my-10" />

      {/* Thought for next time */}
      <motion.section {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.3 }}>
        <h2 className="text-[18px] font-bold text-ink mb-6">A thought for next time</h2>
        <SketchCard className="p-6 bg-ink/[0.02]">
          <p className="text-[16px] text-ink-muted italic leading-[1.9]">{THOUGHT}</p>
        </SketchCard>
      </motion.section>

      {/* Actions */}
      <div className="flex gap-4 justify-center mt-16">
        <Link href="/summary/placeholder/feedback">
          <SketchButton variant="primary" className="!text-[14px] !px-8 !py-2.5">
            Leave feedback
          </SketchButton>
        </Link>
        <SketchButton variant="ghost" href="/dashboard" className="!text-[14px] !px-8 !py-2.5">
          Back to dashboard
        </SketchButton>
      </div>
    </div>
  );
}
