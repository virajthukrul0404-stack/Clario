import { getApp, getApps, initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import type { Analytics } from "firebase/analytics";

const requiredEnvVars = {
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID:
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

for (const [key, value] of Object.entries(requiredEnvVars)) {
  if (!value) {
    throw new Error(`Missing Firebase environment variable: ${key}`);
  }
}

const firebaseConfig = {
  apiKey: requiredEnvVars.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: requiredEnvVars.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: requiredEnvVars.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: requiredEnvVars.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: requiredEnvVars.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: requiredEnvVars.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: requiredEnvVars.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export const firebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

export const db = getFirestore(firebaseApp);

let analyticsInstance: Analytics | null | undefined;

export async function getFirebaseAnalytics(): Promise<Analytics | null> {
  if (typeof window === "undefined") {
    return null;
  }

  if (analyticsInstance !== undefined) {
    return analyticsInstance;
  }

  const { getAnalytics, isSupported } = await import("firebase/analytics");
  const analyticsSupported = await isSupported().catch(() => false);

  analyticsInstance = analyticsSupported ? getAnalytics(firebaseApp) : null;
  return analyticsInstance;
}
