type DebugScalar = boolean | number | string | null | undefined;

type DebugValue = DebugScalar | DebugScalar[];

type FirestoreDebugMeta = Record<string, DebugValue>;

const isFirestoreDebugEnabled = process.env.NODE_ENV !== "production";

export function firestoreRuntimeLog(
  event: string,
  meta: FirestoreDebugMeta = {}
) {
  if (!isFirestoreDebugEnabled || typeof window === "undefined") {
    return;
  }

  // eslint-disable-next-line no-console
  console.info("[firestore-runtime]", {
    event,
    ...meta,
  });
}
