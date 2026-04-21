export const dynamic = "force-dynamic";

import SessionFirestoreExampleClient from "@/components/examples/SessionFirestoreExampleClient";
import type { UserRole } from "@/types/session";

type FirestoreRuntimePageProps = {
  searchParams?: {
    learnerId?: string | string[];
    role?: string | string[];
    sessionId?: string | string[];
    tutorId?: string | string[];
  };
};

function readSearchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export default function FirestoreRuntimePage({
  searchParams = {},
}: FirestoreRuntimePageProps) {
  const tutorId =
    readSearchParam(searchParams.tutorId) ?? "firestore-debug-tutor";
  const learnerId =
    readSearchParam(searchParams.learnerId) ?? "firestore-debug-learner";
  const initialSessionId = readSearchParam(searchParams.sessionId) ?? null;
  const initialParticipantRole =
    readSearchParam(searchParams.role) === "learner"
      ? ("learner" satisfies UserRole)
      : ("tutor" satisfies UserRole);

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-10 text-slate-900">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="space-y-3">
          <span className="inline-flex rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600">
            Temporary Runtime Verification
          </span>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Firestore, Socket.io, and WebRTC runtime test
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">
              Use this page to validate the Firestore-backed session lifecycle,
              optimistic chat updates, Socket.io signaling, and two-tab WebRTC
              call setup.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">
              1. Create or load
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Create a Firestore test session or paste an existing session ID to
              subscribe to it.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">
              2. Open a second tab
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Use the generated second-tab URL so one browser tab joins as the
              tutor and the other joins as the learner.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">
              3. Watch the console
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Browser console logs show Firestore updates, optimistic chat
              inserts, and Socket.io reconnect/join behavior.
            </p>
          </section>
        </div>

        <SessionFirestoreExampleClient
          initialParticipantRole={initialParticipantRole}
          tutorId={tutorId}
          learnerId={learnerId}
          initialSessionId={initialSessionId}
        />
      </div>
    </main>
  );
}
