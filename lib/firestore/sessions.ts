import { FirebaseError } from "firebase/app";
import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit as limitTo,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter as startAfterCursor,
  updateDoc,
  Timestamp,
  type FirestoreDataConverter,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
  type Unsubscribe,
  type WithFieldValue,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  AddSessionMessageInput,
  CreateSessionInput,
  FirestoreTimestampInput,
  GetSessionMessagesOptions,
  Session,
  SessionMessage,
  SessionStatus,
  UserRole,
} from "@/types/session";

type SessionDocument = {
  tutorId: string;
  learnerId: string;
  status: SessionStatus;
  createdAt: Timestamp | null;
  startedAt: FirestoreTimestampInput;
  endedAt: FirestoreTimestampInput;
  callRoomId?: string;
  isCallActive?: boolean;
};

type SessionMessageDocument = {
  senderId: string;
  senderRole: UserRole;
  text: string;
  createdAt: FirestoreTimestampInput;
};

type SessionUpdateData = Partial<{
  status: SessionStatus;
  startedAt: FirestoreTimestampInput;
  endedAt: FirestoreTimestampInput;
  callRoomId: string;
  isCallActive: boolean;
}>;

type AddSessionMessageOptions = {
  messageId?: string;
};

const SESSIONS_COLLECTION = "sessions";
const SESSION_STATUSES: SessionStatus[] = [
  "scheduled",
  "active",
  "ended",
  "cancelled",
];
const USER_ROLES: UserRole[] = ["tutor", "learner"];

function ensureNonEmptyString(value: string, fieldName: string) {
  if (!value.trim()) {
    throw new Error(`${fieldName} is required.`);
  }
}

function readRequiredString(data: Record<string, unknown>, fieldName: string) {
  const value = data[fieldName];

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing or invalid "${fieldName}" in Firestore document.`);
  }

  return value;
}

function readOptionalString(data: Record<string, unknown>, fieldName: string) {
  const value = data[fieldName];

  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "string" && value.trim()) {
    return value;
  }

  throw new Error(`Invalid "${fieldName}" in Firestore document.`);
}

function readTimestamp(value: unknown, fieldName: string) {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Timestamp) {
    return value;
  }

  throw new Error(`Invalid Firestore timestamp for "${fieldName}".`);
}

function readBoolean(data: Record<string, unknown>, fieldName: string) {
  const value = data[fieldName];

  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  throw new Error(`Invalid boolean value for "${fieldName}".`);
}

function readSessionStatus(value: unknown, fieldName: string): SessionStatus {
  if (typeof value === "string" && SESSION_STATUSES.includes(value as SessionStatus)) {
    return value as SessionStatus;
  }

  throw new Error(`Invalid session status for "${fieldName}".`);
}

function readUserRole(value: unknown, fieldName: string): UserRole {
  if (typeof value === "string" && USER_ROLES.includes(value as UserRole)) {
    return value as UserRole;
  }

  throw new Error(`Invalid user role for "${fieldName}".`);
}

function normalizeMessageLimit(limitValue?: number) {
  if (limitValue === undefined) {
    return undefined;
  }

  if (!Number.isFinite(limitValue) || limitValue < 1) {
    throw new Error("limit must be a positive number.");
  }

  return Math.floor(limitValue);
}

function toSession(sessionId: string, data: SessionDocument): Session {
  return {
    id: sessionId,
    tutorId: data.tutorId,
    learnerId: data.learnerId,
    status: data.status,
    createdAt: data.createdAt,
    startedAt: data.startedAt instanceof Timestamp ? data.startedAt : null,
    endedAt: data.endedAt instanceof Timestamp ? data.endedAt : null,
    callRoomId: data.callRoomId,
    isCallActive: data.isCallActive,
  };
}

function toSessionMessage(
  sessionId: string,
  messageId: string,
  data: SessionMessageDocument
): SessionMessage {
  return {
    id: messageId,
    sessionId,
    senderId: data.senderId,
    senderRole: data.senderRole,
    text: data.text,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt : null,
  };
}

export function sortSessionMessages(messages: SessionMessage[]) {
  return [...messages].sort((firstMessage, secondMessage) => {
    const firstTimestamp = firstMessage.createdAt?.toMillis() ?? null;
    const secondTimestamp = secondMessage.createdAt?.toMillis() ?? null;

    if (firstTimestamp === null && secondTimestamp === null) {
      return 0;
    }

    if (firstTimestamp === null) {
      return 1;
    }

    if (secondTimestamp === null) {
      return -1;
    }

    if (firstTimestamp !== secondTimestamp) {
      return firstTimestamp - secondTimestamp;
    }

    return firstMessage.id.localeCompare(secondMessage.id);
  });
}

export function formatFirestoreError(error: unknown) {
  if (error instanceof FirebaseError) {
    const normalizedCode = error.code.replace("firestore/", "");
    return normalizedCode
      ? `Firestore error (${normalizedCode}): ${error.message}`
      : error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "An unknown Firestore error occurred.";
}

export const sessionConverter: FirestoreDataConverter<SessionDocument> = {
  toFirestore(session: WithFieldValue<SessionDocument>) {
    return session;
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options: SnapshotOptions
  ): SessionDocument {
    const data = snapshot.data(options) as Record<string, unknown>;

    return {
      tutorId: readRequiredString(data, "tutorId"),
      learnerId: readRequiredString(data, "learnerId"),
      status: readSessionStatus(data.status, "status"),
      createdAt: readTimestamp(data.createdAt, "createdAt"),
      startedAt: readTimestamp(data.startedAt, "startedAt"),
      endedAt: readTimestamp(data.endedAt, "endedAt"),
      callRoomId: readOptionalString(data, "callRoomId"),
      isCallActive: readBoolean(data, "isCallActive"),
    };
  },
};

export const sessionMessageConverter: FirestoreDataConverter<SessionMessageDocument> =
  {
    toFirestore(message: WithFieldValue<SessionMessageDocument>) {
      return message;
    },
    fromFirestore(
      snapshot: QueryDocumentSnapshot,
      options: SnapshotOptions
    ): SessionMessageDocument {
      const data = snapshot.data(options) as Record<string, unknown>;

      return {
        senderId: readRequiredString(data, "senderId"),
        senderRole: readUserRole(data.senderRole, "senderRole"),
        text: readRequiredString(data, "text"),
        createdAt: readTimestamp(data.createdAt, "createdAt"),
      };
    },
  };

function getSessionsCollection() {
  return collection(db, SESSIONS_COLLECTION).withConverter(sessionConverter);
}

function getSessionDoc(sessionId: string) {
  ensureNonEmptyString(sessionId, "sessionId");
  return doc(getSessionsCollection(), sessionId);
}

function getSessionMessagesCollection(sessionId: string) {
  return collection(getSessionDoc(sessionId), "messages").withConverter(
    sessionMessageConverter
  );
}

function buildSessionMessagesQuery(
  sessionId: string,
  options: GetSessionMessagesOptions = {}
) {
  const constraints: QueryConstraint[] = [
    orderBy("createdAt", "asc"),
    orderBy(documentId(), "asc"),
  ];
  const normalizedLimit = normalizeMessageLimit(options.limit);

  if (normalizedLimit !== undefined) {
    constraints.push(limitTo(normalizedLimit));
  }

  if (options.startAfterMessage?.createdAt) {
    constraints.push(
      startAfterCursor(
        options.startAfterMessage.createdAt,
        options.startAfterMessage.id
      )
    );
  }

  return query(getSessionMessagesCollection(sessionId), ...constraints);
}

async function updateSession(sessionId: string, data: SessionUpdateData) {
  ensureNonEmptyString(sessionId, "sessionId");

  try {
    await updateDoc(getSessionDoc(sessionId), data);
    const session = await getSessionById(sessionId);

    if (!session) {
      throw new Error("Session was updated but could not be reloaded.");
    }

    return session;
  } catch (error) {
    throw new Error(
      `Failed to update session "${sessionId}": ${formatFirestoreError(error)}`
    );
  }
}

export function createSessionMessageId(sessionId: string) {
  return doc(getSessionMessagesCollection(sessionId)).id;
}

export async function createSession(input: CreateSessionInput): Promise<Session> {
  ensureNonEmptyString(input.tutorId, "tutorId");
  ensureNonEmptyString(input.learnerId, "learnerId");

  try {
    const sessionRef = doc(getSessionsCollection());

    await setDoc(sessionRef, {
      tutorId: input.tutorId,
      learnerId: input.learnerId,
      status: input.status ?? "scheduled",
      createdAt: serverTimestamp(),
      startedAt: input.startedAt ?? null,
      endedAt: input.endedAt ?? null,
      callRoomId: input.callRoomId ?? sessionRef.id,
      isCallActive: input.isCallActive ?? false,
    });

    const snapshot = await getDoc(sessionRef);

    if (!snapshot.exists()) {
      throw new Error("Session document was created but not found.");
    }

    return toSession(snapshot.id, snapshot.data());
  } catch (error) {
    throw new Error(`Failed to create session: ${formatFirestoreError(error)}`);
  }
}

export async function getSessionById(sessionId: string): Promise<Session | null> {
  ensureNonEmptyString(sessionId, "sessionId");

  try {
    const snapshot = await getDoc(getSessionDoc(sessionId));

    if (!snapshot.exists()) {
      return null;
    }

    return toSession(snapshot.id, snapshot.data());
  } catch (error) {
    throw new Error(
      `Failed to fetch session "${sessionId}": ${formatFirestoreError(error)}`
    );
  }
}

export function subscribeToSession(
  sessionId: string,
  onData: (session: Session | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  ensureNonEmptyString(sessionId, "sessionId");

  return onSnapshot(
    getSessionDoc(sessionId),
    (snapshot) => {
      onData(snapshot.exists() ? toSession(snapshot.id, snapshot.data()) : null);
    },
    (error) => {
      onError?.(
        new Error(
          `Failed to subscribe to session "${sessionId}": ${formatFirestoreError(
            error
          )}`
        )
      );
    }
  );
}

export async function updateSessionStatus(
  sessionId: string,
  status: SessionStatus
): Promise<Session> {
  return updateSession(sessionId, { status });
}

export async function markSessionStarted(sessionId: string): Promise<Session> {
  return updateSession(sessionId, {
    status: "active",
    startedAt: serverTimestamp(),
    isCallActive: true,
  });
}

export async function markSessionEnded(sessionId: string): Promise<Session> {
  return updateSession(sessionId, {
    status: "ended",
    endedAt: serverTimestamp(),
    isCallActive: false,
  });
}

export async function addSessionMessage(
  sessionId: string,
  input: AddSessionMessageInput,
  options: AddSessionMessageOptions = {}
): Promise<SessionMessage> {
  ensureNonEmptyString(sessionId, "sessionId");
  ensureNonEmptyString(input.senderId, "senderId");
  ensureNonEmptyString(input.text, "text");

  try {
    const trimmedText = input.text.trim();
    const sessionSnapshot = await getDoc(getSessionDoc(sessionId));

    if (!sessionSnapshot.exists()) {
      throw new Error(`Session "${sessionId}" does not exist.`);
    }

    const messageRef = options.messageId
      ? doc(getSessionMessagesCollection(sessionId), options.messageId)
      : doc(getSessionMessagesCollection(sessionId));

    await setDoc(messageRef, {
      senderId: input.senderId,
      senderRole: input.senderRole,
      text: trimmedText,
      createdAt: serverTimestamp(),
    });

    return {
      id: messageRef.id,
      sessionId,
      senderId: input.senderId,
      senderRole: input.senderRole,
      text: trimmedText,
      createdAt: null,
    };
  } catch (error) {
    throw new Error(
      `Failed to add message to session "${sessionId}": ${formatFirestoreError(
        error
      )}`
    );
  }
}

export async function getSessionMessages(
  sessionId: string,
  options: GetSessionMessagesOptions = {}
): Promise<SessionMessage[]> {
  ensureNonEmptyString(sessionId, "sessionId");

  try {
    const snapshot = await getDocs(buildSessionMessagesQuery(sessionId, options));

    return sortSessionMessages(
      snapshot.docs.map((documentSnapshot) =>
        toSessionMessage(sessionId, documentSnapshot.id, documentSnapshot.data())
      )
    );
  } catch (error) {
    throw new Error(
      `Failed to fetch messages for session "${sessionId}": ${formatFirestoreError(
        error
      )}`
    );
  }
}

export function subscribeToSessionMessages(
  sessionId: string,
  onData: (messages: SessionMessage[]) => void,
  onError?: (error: Error) => void,
  options: GetSessionMessagesOptions = {}
): Unsubscribe {
  ensureNonEmptyString(sessionId, "sessionId");

  return onSnapshot(
    buildSessionMessagesQuery(sessionId, options),
    (snapshot) => {
      const messages = snapshot.docs.map((documentSnapshot) =>
        toSessionMessage(sessionId, documentSnapshot.id, documentSnapshot.data())
      );

      onData(sortSessionMessages(messages));
    },
    (error) => {
      onError?.(
        new Error(
          `Failed to subscribe to messages for session "${sessionId}": ${formatFirestoreError(
            error
          )}`
        )
      );
    }
  );
}
