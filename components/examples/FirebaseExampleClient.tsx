"use client";

import { useEffect, useMemo, useState } from "react";
import { doc } from "firebase/firestore";
import { db, firebaseApp, getFirebaseAnalytics } from "@/lib/firebase";

export default function FirebaseExampleClient() {
  const [analyticsStatus, setAnalyticsStatus] = useState("Checking analytics...");

  const healthcheckRef = useMemo(() => doc(db, "healthcheck", "example"), []);

  useEffect(() => {
    let active = true;

    async function setupAnalytics() {
      const analytics = await getFirebaseAnalytics();

      if (!active) {
        return;
      }

      if (!analytics) {
        setAnalyticsStatus("Analytics unavailable in this environment.");
        return;
      }

      const { logEvent } = await import("firebase/analytics");
      logEvent(analytics, "firebase_example_loaded");
      setAnalyticsStatus("Analytics ready.");
    }

    void setupAnalytics();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">Firebase Example</h2>
      <p className="mt-2 text-sm text-gray-600">
        Project: {firebaseApp.options.projectId}
      </p>
      <p className="mt-1 text-sm text-gray-600">
        Firestore doc path: {healthcheckRef.path}
      </p>
      <p className="mt-1 text-sm text-gray-600">{analyticsStatus}</p>
    </div>
  );
}
