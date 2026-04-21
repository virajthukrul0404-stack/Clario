/* Feedback page — five thoughtful questions with custom rating circles and spark animations. */
"use client";

export const dynamic = 'force-dynamic';
import React, { useState } from "react";
import { motion } from "framer-motion";
import { SketchButton } from "@/components/ui/SketchButton";

function RatingCircle({ value, selected, onClick }: { value: number; selected: boolean; onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      className="relative"
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
    >
      <motion.div
        className={`w-12 h-12 rounded-full flex items-center justify-center font-hand font-bold text-[18px] transition-colors ${
          selected ? "bg-ink text-warm-white" : "text-ink-muted"
        }`}
        animate={selected ? { scale: [1, 1.15, 1] } : {}}
        transition={{ duration: 0.3 }}
      >
        {/* Sketch border when not selected */}
        {!selected && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink/[0.15]" />
          </svg>
        )}
        0{value}
      </motion.div>

      {/* Spark lines on selection */}
      {selected && (
        <>
          {[0, 90, 180, 270].map((angle) => (
            <motion.div
              key={angle}
              className="absolute top-1/2 left-1/2 w-[3px] h-[10px] bg-ink origin-bottom"
              style={{
                transform: `translate(-50%, -100%) rotate(${angle}deg) translateY(-24px)`,
              }}
              initial={{ scaleY: 0, opacity: 0 }}
              animate={{ scaleY: [0, 1, 0], opacity: [0, 1, 0] }}
              transition={{ duration: 0.4, delay: 0.05 }}
            />
          ))}
        </>
      )}
    </motion.button>
  );
}

export default function FeedbackPage() {
  const [rating, setRating] = useState<number | null>(null);
  const [wellText, setWellText] = useState("");
  const [improveText, setImproveText] = useState("");
  const [recommend, setRecommend] = useState<"yes" | "maybe" | null>(null);
  const [bookAgain, setBookAgain] = useState(false);

  return (
    <div className="w-full max-w-[580px] mx-auto px-6 py-12 pb-24">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <h1 className="text-[32px] font-bold text-ink">
          How was your{" "}
          <span className="font-hand inline-block" style={{ transform: "rotate(-2deg)" }}>
            session
          </span>
          ?
        </h1>
        <p className="text-ink-muted text-[16px] mt-3 leading-relaxed">
          Your feedback helps Maya improve and helps other learners decide.
        </p>
      </motion.div>

      <div className="flex flex-col gap-10 mt-12">
        {/* Q1: Overall rating */}
        <div>
          <p className="text-[15px] font-bold text-ink mb-5">How was the session overall?</p>
          <div className="flex gap-3">
            {[1, 2, 3, 4, 5].map((v) => (
              <RatingCircle key={v} value={v} selected={rating === v} onClick={() => setRating(v)} />
            ))}
          </div>
        </div>

        {/* Q2: What went well */}
        <div>
          <p className="text-[15px] font-bold text-ink mb-4">What went particularly well?</p>
          <div className="relative">
            <textarea
              value={wellText}
              onChange={(e) => setWellText(e.target.value)}
              placeholder='The explanation of X was really clear when...'
              className="w-full min-h-[100px] p-4 bg-transparent text-ink text-[15px] placeholder:text-ink-muted/50 outline-none resize-y leading-relaxed"
            />
            <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 400 100">
              <path d="M 6 6 C 100 3, 300 4, 394 6 C 396 25, 395 75, 393 94 C 300 97, 100 96, 6 94 C 4 75, 5 25, 6 6" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink/[0.12]" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* Q3: Explore differently */}
        <div>
          <p className="text-[15px] font-bold text-ink mb-4">
            Is there anything you&apos;d like to explore differently next time?
          </p>
          <div className="relative">
            <textarea
              value={improveText}
              onChange={(e) => setImproveText(e.target.value)}
              placeholder="I'd love to spend more time on..."
              className="w-full min-h-[80px] p-4 bg-transparent text-ink text-[15px] placeholder:text-ink-muted/50 outline-none resize-y leading-relaxed"
            />
            <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 400 80">
              <path d="M 6 6 C 100 3, 300 4, 394 6 C 396 20, 395 60, 393 74 C 300 77, 100 76, 6 74 C 4 60, 5 20, 6 6" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink/[0.12]" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* Q4: Recommend */}
        <div>
          <p className="text-[15px] font-bold text-ink mb-4">
            Would you recommend this teacher to someone you know?
          </p>
          <div className="flex gap-3">
            {(["yes", "maybe"] as const).map((opt) => (
              <SketchButton
                key={opt}
                variant={recommend === opt ? "primary" : "ghost"}
                onClick={() => setRecommend(opt)}
                className="!text-[14px] !px-6 !py-2.5"
              >
                {opt === "yes" ? "Yes, definitely" : "Maybe later"}
              </SketchButton>
            ))}
          </div>
        </div>

        {/* Q5: Book again */}
        <div className="flex items-center gap-3">
          <button onClick={() => setBookAgain(!bookAgain)} className="flex-shrink-0">
            <svg viewBox="0 0 20 20" className="w-5 h-5 text-ink">
              <rect x="1" y="1" width="18" height="18" rx="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
              {bookAgain && (
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
          <span className="text-[15px] text-ink">
            I&apos;d like to book another session with Maya
          </span>
        </div>
      </div>

      {/* Submit */}
      <div className="mt-12">
        <SketchButton variant="primary" className="w-full !text-[15px] !py-3">
          Submit feedback
        </SketchButton>
        <button className="w-full text-center text-[14px] text-ink-faint mt-4 hover:text-ink-muted transition-colors">
          Skip for now
        </button>
      </div>
    </div>
  );
}
