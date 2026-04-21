"use client";

import { useEffect, useRef, useState } from "react";
import { firestoreRuntimeLog } from "@/lib/firestore/debug";
import {
  formatFirestoreError,
  subscribeToSession,
} from "@/lib/firestore/sessions";
import type { Session } from "@/types/session";

function getSessionSnapshotKey(session: Session | null) {
  if (!session) {
    return "missing";
  }

  return [
    session.id,
    session.status,
    session.createdAt?.toMillis() ?? "pending",
    session.startedAt?.toMillis() ?? "pending",
    session.endedAt?.toMillis() ?? "pending",
    session.callRoomId ?? "no-room",
    session.isCallActive ?? "unknown",
  ].join(":");
}

export function useSession(sessionId: string | null) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(sessionId));
  const [error, setError] = useState<string | null>(null);
  const lastSessionSnapshotKeyRef = useRef("");

  useEffect(() => {
    if (!sessionId) {
      lastSessionSnapshotKeyRef.current = "";
      setSession(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsubscribe = subscribeToSession(
      sessionId,
      (nextSession) => {
        const nextSnapshotKey = getSessionSnapshotKey(nextSession);
        const hasChanged =
          lastSessionSnapshotKeyRef.current !== nextSnapshotKey;

        firestoreRuntimeLog("session subscription update", {
          sessionId,
          exists: Boolean(nextSession),
          status: nextSession?.status ?? null,
          hasChanged,
          isCallActive: nextSession?.isCallActive ?? null,
          startedAtMs: nextSession?.startedAt?.toMillis() ?? null,
          endedAtMs: nextSession?.endedAt?.toMillis() ?? null,
        });

        if (hasChanged) {
          lastSessionSnapshotKeyRef.current = nextSnapshotKey;
          setSession(nextSession);
        }

        setIsLoading(false);
      },
      (subscriptionError) => {
        setError(formatFirestoreError(subscriptionError));
        setIsLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [sessionId]);

  return {
    session,
    isLoading,
    error,
  };
}
