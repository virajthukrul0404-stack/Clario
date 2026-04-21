"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  createSession,
  markSessionEnded,
  markSessionStarted,
  updateSessionStatus,
} from "@/lib/firestore/sessions";
import { useSession } from "@/hooks/useSession";
import { useSessionMessages } from "@/hooks/useSessionMessages";
import type { UserRole } from "@/types/session";

type SessionFirestoreExampleClientProps = {
  initialParticipantRole?: UserRole;
  initialSessionId?: string | null;
  tutorId: string;
  learnerId: string;
};

function formatTimestampLabel(timestamp: { toDate(): Date } | null | undefined) {
  if (!timestamp) {
    return "Pending";
  }

  return timestamp.toDate().toLocaleString();
}

function getOppositeRole(role: UserRole): UserRole {
  return role === "tutor" ? "learner" : "tutor";
}

export default function SessionFirestoreExampleClient({
  initialParticipantRole = "tutor",
  initialSessionId = null,
  tutorId,
  learnerId,
}: SessionFirestoreExampleClientProps) {
  const pathname = usePathname();
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [sessionIdInput, setSessionIdInput] = useState(initialSessionId ?? "");
  const [draft, setDraft] = useState("");
  const [participantRole, setParticipantRole] =
    useState<UserRole>(initialParticipantRole);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const {
    session,
    isLoading: isLoadingSession,
    error: sessionError,
  } = useSession(sessionId);
  const {
    messages,
    isLoading: isLoadingMessages,
    error: messagesError,
    sendMessage,
  } = useSessionMessages(sessionId, { limit: 50 });

  const participantId =
    participantRole === "tutor" ? tutorId : learnerId;
  const peerParticipantRole = getOppositeRole(participantRole);

  const shareablePath = useMemo(() => {
    if (!sessionId) {
      return null;
    }

    const params = new URLSearchParams({
      learnerId,
      role: participantRole,
      sessionId,
      tutorId,
    });

    return `${pathname}?${params.toString()}`;
  }, [learnerId, participantRole, pathname, sessionId, tutorId]);

  const peerPath = useMemo(() => {
    if (!sessionId) {
      return null;
    }

    const params = new URLSearchParams({
      learnerId,
      role: peerParticipantRole,
      sessionId,
      tutorId,
    });

    return `${pathname}?${params.toString()}`;
  }, [learnerId, pathname, peerParticipantRole, sessionId, tutorId]);

  useEffect(() => {
    setSessionId(initialSessionId);
    setSessionIdInput(initialSessionId ?? "");
  }, [initialSessionId]);

  useEffect(() => {
    setParticipantRole(initialParticipantRole);
  }, [initialParticipantRole]);

  function syncSessionId(nextSessionId: string | null) {
    setSessionId(nextSessionId);
    setSessionIdInput(nextSessionId ?? "");

    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);

    if (nextSessionId) {
      params.set("sessionId", nextSessionId);
      params.set("tutorId", tutorId);
      params.set("learnerId", learnerId);
      params.set("role", participantRole);
    } else {
      params.delete("sessionId");
    }

    const nextSearch = params.toString();
    const nextUrl = nextSearch ? `${pathname}?${nextSearch}` : pathname;

    window.history.replaceState(null, "", nextUrl);
  }

  async function handleCreateSession() {
    setIsSaving(true);
    setError(null);

    try {
      const nextSession = await createSession({
        tutorId,
        learnerId,
      });
      syncSessionId(nextSession.id);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Unable to create a Firestore session."
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleLoadSession() {
    const nextSessionId = sessionIdInput.trim();

    if (!nextSessionId) {
      setError("Enter a Firestore session ID to subscribe.");
      return;
    }

    setError(null);
    syncSessionId(nextSessionId);
  }

  async function handleClearSession() {
    setDraft("");
    setError(null);
    syncSessionId(null);
  }

  async function handleStartCall() {
    if (!session) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await markSessionStarted(session.id);
    } catch (statusError) {
      setError(
        statusError instanceof Error
          ? statusError.message
          : "Unable to start the call."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleEndCall() {
    if (!session) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await markSessionEnded(session.id);
    } catch (statusError) {
      setError(
        statusError instanceof Error
          ? statusError.message
          : "Unable to end the call."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCancelSession() {
    if (!session) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await updateSessionStatus(session.id, "cancelled");
    } catch (statusError) {
      setError(
        statusError instanceof Error
          ? statusError.message
          : "Unable to cancel the session."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSendMessage() {
    if (!draft.trim() || !sessionId) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await sendMessage({
        senderId: participantId,
        senderRole: participantRole,
        text: draft,
      });
      setDraft("");
    } catch (messageError) {
      setError(
        messageError instanceof Error
          ? messageError.message
          : "Unable to send a Firestore message."
      );
    } finally {
      setIsSaving(false);
    }
  }

  const sessionMissing =
    Boolean(sessionId) &&
    !session &&
    !isLoadingSession &&
    !sessionError;

  return (
    <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-slate-900">
          Session Firestore Example
        </h2>
        <p className="text-sm leading-6 text-slate-600">
          Firestore drives session and chat state in this example flow, so you
          can validate the data layer without the live-call transport.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-col gap-3 lg:flex-row">
          <label className="flex-1">
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Session ID
            </span>
            <input
              value={sessionIdInput}
              onChange={(event) => setSessionIdInput(event.target.value)}
              placeholder="Create a session or paste an existing session ID"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
            />
          </label>

          <div className="flex flex-wrap items-end gap-2">
            <button
              type="button"
              onClick={handleLoadSession}
              disabled={isSaving}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
            >
              Load session
            </button>
            <button
              type="button"
              onClick={handleCreateSession}
              disabled={isSaving}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
            >
              Create session
            </button>
            <button
              type="button"
              onClick={handleClearSession}
              disabled={!sessionId || isSaving}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
            >
              Clear
            </button>
          </div>
        </div>

        {shareablePath ? (
          <div className="mt-3 space-y-2 rounded-xl bg-white px-3 py-2 text-xs text-slate-600">
            <div>
              <span className="font-semibold text-slate-800">This tab:</span>{" "}
              <code>{shareablePath}</code>
            </div>
            <div>
              <span className="font-semibold text-slate-800">
                Open this in the second tab:
              </span>{" "}
              <code>{peerPath}</code>
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
        <section className="space-y-4 rounded-2xl border border-slate-200 p-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleStartCall}
              disabled={!session || Boolean(session?.isCallActive) || isSaving}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
            >
              Start Call
            </button>
            <button
              type="button"
              onClick={handleEndCall}
              disabled={!session?.isCallActive || isSaving}
              className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-60"
            >
              End Call
            </button>
            <button
              type="button"
              onClick={handleCancelSession}
              disabled={!session || Boolean(session?.isCallActive) || isSaving}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel session
            </button>
          </div>

          {sessionId ? (
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
              <p>
                <span className="font-medium text-slate-900">Session ID:</span>{" "}
                {sessionId}
              </p>
              <p>
                <span className="font-medium text-slate-900">Status:</span>{" "}
                {session?.status ?? "Loading..."}
              </p>
              <p>
                <span className="font-medium text-slate-900">Call room:</span>{" "}
                {session?.callRoomId ?? "Pending room assignment"}
              </p>
              <p>
                <span className="font-medium text-slate-900">Call active:</span>{" "}
                {session?.isCallActive === undefined
                  ? "Pending"
                  : session.isCallActive
                    ? "Yes"
                    : "No"}
              </p>
              <p>
                <span className="font-medium text-slate-900">Created:</span>{" "}
                {formatTimestampLabel(session?.createdAt)}
              </p>
              <p>
                <span className="font-medium text-slate-900">Started:</span>{" "}
                {formatTimestampLabel(session?.startedAt)}
              </p>
              <p>
                <span className="font-medium text-slate-900">Ended:</span>{" "}
                {formatTimestampLabel(session?.endedAt)}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
              Create or load a session to start the Firestore subscriptions.
            </div>
          )}

          {sessionMissing ? (
            <p className="text-sm text-amber-700">
              No Firestore session document exists for this ID yet.
            </p>
          ) : null}

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            The live call UI now uses the production session room transport, so
            this Firestore example stays focused on session records and chat.
          </div>
        </section>

        <aside className="space-y-4 rounded-2xl border border-slate-200 p-4">
          <div>
            <p className="text-sm font-medium text-slate-900">
              Participant role
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Pick which side this browser tab represents before starting the
              call.
            </p>
            <div className="mt-2 inline-flex rounded-xl border border-slate-300 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setParticipantRole("tutor")}
                disabled={Boolean(session?.isCallActive)}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  participantRole === "tutor"
                    ? "bg-slate-900 text-white"
                    : "text-slate-700"
                } disabled:opacity-60`}
              >
                Tutor
              </button>
              <button
                type="button"
                onClick={() => setParticipantRole("learner")}
                disabled={Boolean(session?.isCallActive)}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  participantRole === "learner"
                    ? "bg-slate-900 text-white"
                    : "text-slate-700"
                } disabled:opacity-60`}
              >
                Learner
              </button>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
            <p>
              <span className="font-medium text-slate-900">Tutor ID:</span>{" "}
              {tutorId}
            </p>
            <p>
              <span className="font-medium text-slate-900">Learner ID:</span>{" "}
              {learnerId}
            </p>
            <p>
              <span className="font-medium text-slate-900">
                Active participant:
              </span>{" "}
              {participantRole} ({participantId})
            </p>
          </div>
        </aside>
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-slate-900">Messages</div>
            <p className="text-sm text-slate-500">
              Chat stays on Firestore snapshots in this example client.
            </p>
          </div>
          <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
            {isLoadingMessages ? "Subscribing" : `${messages.length} total`}
          </div>
        </div>

        <div className="max-h-80 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-3">
          {isLoadingMessages ? (
            <p className="text-sm text-slate-500">Subscribing to messages...</p>
          ) : messages.length > 0 ? (
            messages.map((message) => (
              <div
                key={message.id}
                className={`rounded-xl border px-3 py-2 text-sm ${
                  message.senderRole === "tutor"
                    ? "border-slate-200 bg-white text-slate-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-900"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{message.senderRole}</span>
                  <span className="text-xs text-slate-400">
                    {message.createdAt
                      ? message.createdAt.toDate().toLocaleTimeString()
                      : "Sending..."}
                  </span>
                </div>
                <p className="mt-1">{message.text}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">No messages yet.</p>
          )}
        </div>

        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Send a Firestore test message"
            className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleSendMessage}
            disabled={!sessionId || isSaving}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
          >
            Send
          </button>
        </div>
      </div>

      {isLoadingSession ? (
        <p className="text-sm text-slate-500">
          Listening for session updates...
        </p>
      ) : null}

      {error || sessionError || messagesError ? (
        <p className="text-sm text-red-600">
          {error ?? sessionError ?? messagesError}
        </p>
      ) : null}
    </div>
  );
}
