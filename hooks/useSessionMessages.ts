"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { firestoreRuntimeLog } from "@/lib/firestore/debug";
import {
  addSessionMessage,
  createSessionMessageId,
  formatFirestoreError,
  getSessionMessages,
  sortSessionMessages,
  subscribeToSessionMessages,
} from "@/lib/firestore/sessions";
import type {
  GetSessionMessagesOptions,
  SessionMessage,
  UserRole,
} from "@/types/session";

type SendMessageInput = {
  senderId: string;
  senderRole: UserRole;
  text: string;
};

function mergeMessages(
  liveMessages: SessionMessage[],
  optimisticMessages: SessionMessage[]
) {
  const messageMap = new Map<string, SessionMessage>();

  for (const message of liveMessages) {
    messageMap.set(message.id, message);
  }

  for (const message of optimisticMessages) {
    if (!messageMap.has(message.id)) {
      messageMap.set(message.id, message);
    }
  }

  return sortSessionMessages(Array.from(messageMap.values()));
}

function getCursorKey(message: SessionMessage | null | undefined) {
  if (!message) {
    return "";
  }

  return `${message.id}:${message.createdAt?.toMillis() ?? "pending"}`;
}

function getMessageSnapshotKey(messages: SessionMessage[]) {
  return messages
    .map(
      (message) =>
        `${message.id}:${message.createdAt?.toMillis() ?? "pending"}:${
          message.senderRole
        }:${message.text}`
    )
    .join("|");
}

function getMessageIdPreview(messages: SessionMessage[], max = 6) {
  return messages.slice(0, max).map((message) => message.id);
}

function getConfirmedOptimisticMessages(
  liveMessages: SessionMessage[],
  optimisticMessages: SessionMessage[]
) {
  const liveMessageMap = new Map(
    liveMessages.map((message) => [message.id, message])
  );

  return optimisticMessages.filter((optimisticMessage) => {
    const matchingLiveMessage = liveMessageMap.get(optimisticMessage.id);
    return Boolean(matchingLiveMessage?.createdAt);
  });
}

export function useSessionMessages(
  sessionId: string | null,
  options: GetSessionMessagesOptions = {}
) {
  const [liveMessages, setLiveMessages] = useState<SessionMessage[]>([]);
  const [optimisticMessages, setOptimisticMessages] = useState<SessionMessage[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(Boolean(sessionId));
  const [error, setError] = useState<string | null>(null);
  const cursorKey = getCursorKey(options.startAfterMessage);
  const lastLiveSnapshotKeyRef = useRef("");
  const optimisticMessagesRef = useRef<SessionMessage[]>([]);

  function setOptimisticMessagesState(
    nextState:
      | SessionMessage[]
      | ((currentMessages: SessionMessage[]) => SessionMessage[])
  ) {
    const resolvedState =
      typeof nextState === "function"
        ? nextState(optimisticMessagesRef.current)
        : nextState;

    optimisticMessagesRef.current = resolvedState;
    setOptimisticMessages(resolvedState);
  }

  async function refreshMessages() {
    if (!sessionId) {
      lastLiveSnapshotKeyRef.current = "";
      setLiveMessages([]);
      setOptimisticMessagesState([]);
      setError(null);
      setIsLoading(false);
      return [];
    }

    setIsLoading(true);
    setError(null);

    try {
      const nextMessages = await getSessionMessages(sessionId, options);
      lastLiveSnapshotKeyRef.current = getMessageSnapshotKey(nextMessages);
      setLiveMessages(nextMessages);
      return nextMessages;
    } catch (refreshError) {
      const message = formatFirestoreError(refreshError);
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }

  async function sendMessage(input: SendMessageInput) {
    if (!sessionId) {
      throw new Error("A session must be selected before sending messages.");
    }

    const trimmedText = input.text.trim();

    if (!trimmedText) {
      throw new Error("Message text is required.");
    }

    const messageId = createSessionMessageId(sessionId);
    const optimisticMessage: SessionMessage = {
      id: messageId,
      sessionId,
      senderId: input.senderId,
      senderRole: input.senderRole,
      text: trimmedText,
      createdAt: null,
    };

    setError(null);

    firestoreRuntimeLog("optimistic message insertion", {
      sessionId,
      messageId,
      senderRole: input.senderRole,
      textLength: trimmedText.length,
    });

    setOptimisticMessagesState((currentMessages) =>
      mergeMessages(currentMessages, [optimisticMessage])
    );

    try {
      await addSessionMessage(
        sessionId,
        {
          ...input,
          text: trimmedText,
        },
        { messageId }
      );

      return optimisticMessage;
    } catch (sendError) {
      setOptimisticMessagesState((currentMessages) =>
        currentMessages.filter((message) => message.id !== messageId)
      );
      const message = formatFirestoreError(sendError);
      setError(message);
      throw new Error(message);
    }
  }

  useEffect(() => {
    if (!sessionId) {
      lastLiveSnapshotKeyRef.current = "";
      setLiveMessages([]);
      setOptimisticMessagesState([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsubscribe = subscribeToSessionMessages(
      sessionId,
      (nextMessages) => {
        const nextSnapshotKey = getMessageSnapshotKey(nextMessages);
        const hasChanged =
          lastLiveSnapshotKeyRef.current !== nextSnapshotKey;
        const confirmedOptimisticMessages = getConfirmedOptimisticMessages(
          nextMessages,
          optimisticMessagesRef.current
        );

        firestoreRuntimeLog("message subscription update", {
          sessionId,
          count: nextMessages.length,
          confirmedCount: nextMessages.filter((message) => Boolean(message.createdAt))
            .length,
          pendingCount: nextMessages.filter((message) => !message.createdAt).length,
          hasChanged,
          messageIds: getMessageIdPreview(nextMessages),
        });

        if (hasChanged) {
          lastLiveSnapshotKeyRef.current = nextSnapshotKey;
          setLiveMessages(nextMessages);
        }

        if (confirmedOptimisticMessages.length > 0) {
          const confirmedMessageIds = confirmedOptimisticMessages.map(
            (message) => message.id
          );
          const confirmedMessageIdSet = new Set(confirmedMessageIds);

          firestoreRuntimeLog("server-confirmed message replacement", {
            sessionId,
            count: confirmedMessageIds.length,
            messageIds: confirmedMessageIds,
          });

          setOptimisticMessagesState((currentMessages) =>
            currentMessages.filter(
              (message) => !confirmedMessageIdSet.has(message.id)
            )
          );
        }

        setIsLoading(false);
      },
      (subscriptionError) => {
        setError(subscriptionError.message);
        setIsLoading(false);
      },
      options
    );

    return () => {
      unsubscribe();
    };
  }, [sessionId, options.limit, cursorKey]);

  const messages = useMemo(
    () => mergeMessages(liveMessages, optimisticMessages),
    [liveMessages, optimisticMessages]
  );

  return {
    messages,
    isLoading,
    error,
    refreshMessages,
    sendMessage,
  };
}
