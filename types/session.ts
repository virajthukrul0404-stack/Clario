import type { FieldValue, Timestamp } from "firebase/firestore";

export type SessionStatus = "scheduled" | "active" | "ended" | "cancelled";

export type UserRole = "tutor" | "learner";

export type FirestoreTimestamp = Timestamp | null;

export type FirestoreTimestampInput = Timestamp | FieldValue | null;

export interface Session {
  id: string;
  tutorId: string;
  learnerId: string;
  status: SessionStatus;
  createdAt: FirestoreTimestamp;
  startedAt: FirestoreTimestamp;
  endedAt: FirestoreTimestamp;
  callRoomId?: string;
  isCallActive?: boolean;
}

export interface SessionMessage {
  id: string;
  sessionId: string;
  senderId: string;
  senderRole: UserRole;
  text: string;
  createdAt: FirestoreTimestamp;
}

export interface CreateSessionInput {
  tutorId: string;
  learnerId: string;
  status?: SessionStatus;
  startedAt?: FirestoreTimestampInput;
  endedAt?: FirestoreTimestampInput;
  callRoomId?: string;
  isCallActive?: boolean;
}

export interface AddSessionMessageInput {
  senderId: string;
  senderRole: UserRole;
  text: string;
}

export interface GetSessionMessagesOptions {
  limit?: number;
  startAfterMessage?: SessionMessage | null;
}
