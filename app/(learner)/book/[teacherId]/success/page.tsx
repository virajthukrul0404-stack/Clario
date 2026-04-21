/* Booking Success Page — a celebratory but calm "ritual complete" screen with a handwritten thank you. */
"use client";

export const dynamic = 'force-dynamic';
import React from "react";
import { motion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { SketchButton } from "@/components/ui/SketchButton";
import { SketchCard } from "@/components/ui/SketchCard";
import { ProfileAvatar } from "@/components/ui/ProfileAvatar";
import { Doodle } from "@/components/ui/Doodle";

export default function BookingSuccessPage() {
  const search = useSearchParams();
  const teacherName = search.get("teacher") || "Your teacher";
  const room = search.get("room");

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative"
      >
        {/* Confetti-like doodles */}
        <div className="absolute -top-12 -left-12 opacity-20">
          <Doodle type="stars-cluster" className="w-24 h-24" />
        </div>
        <div className="absolute -bottom-12 -right-12 opacity-20 rotate-180">
          <Doodle type="stars-cluster" className="w-24 h-24" />
        </div>

        <SketchCard tilt={-1} className="p-12 max-w-lg bg-ink/[0.02]">
          <div className="flex justify-center mb-8">
            <div className="relative">
              <ProfileAvatar seed={teacherName} size={80} />
              <motion.div
                className="absolute -inset-2"
                initial={{ rotate: 0 }}
                animate={{ rotate: 360 }}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              >
                 <svg viewBox="0 0 100 100" className="w-full h-full text-ink/[0.1]">
                   <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" />
                 </svg>
              </motion.div>
            </div>
          </div>

          <h1 className="text-[32px] font-bold text-ink leading-tight">
            Booking{" "}
            <span className="font-hand inline-block" style={{ transform: "rotate(-2deg)" }}>
              confirmed
            </span>
          </h1>
          
          <p className="text-ink-muted text-[16px] mt-4 leading-relaxed">
            You&apos;re all set! A calendar invite has been sent to your email. {teacherName} is looking forward to seeing you.
          </p>

          <div className="mt-10 flex flex-col gap-3">
            {room ? (
              <SketchButton variant="primary" href={`/session/${room}`} className="w-full">
                Start session
              </SketchButton>
            ) : null}
            <SketchButton variant="primary" href="/bookings" className="w-full">
              View my sessions
            </SketchButton>
            <SketchButton variant="ghost" href="/dashboard" className="w-full">
              Back to dashboard
            </SketchButton>
          </div>
        </SketchCard>
      </motion.div>

      <motion.p
        className="font-hand text-[20px] text-ink-muted mt-12"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        See you in the session room.
      </motion.p>
    </div>
  );
}
