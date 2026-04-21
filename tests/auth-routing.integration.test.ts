import { describe, expect, it } from "vitest";
import { resolvePostAuthRoute } from "@/lib/auth-routing";

describe("auth routing integration flows", () => {
  it("sign-up user goes to onboarding only once", () => {
    const firstLogin = resolvePostAuthRoute({
      role: "LEARNER",
      learnerProfile: { onboardingCompleted: false, goals: "" },
    });
    const returning = resolvePostAuthRoute({
      role: "LEARNER",
      learnerProfile: { onboardingCompleted: true, goals: "Master SQL" },
    });

    expect(firstLogin).toBe("/onboarding/learner-setup");
    expect(returning).toBe("/dashboard");
  });

  it("sign-in existing learner routes directly to learner dashboard", () => {
    const route = resolvePostAuthRoute({
      role: "LEARNER",
      learnerProfile: { onboardingCompleted: true, goals: "Leadership coaching" },
    });
    expect(route).toBe("/dashboard");
  });

  it("role-based dashboard routing stays correct", () => {
    const teacherRoute = resolvePostAuthRoute({
      role: "TEACHER",
      teacherProfile: { onboardingCompleted: true, bio: "10y PM", hourlyRate: 120 },
    });
    const learnerRoute = resolvePostAuthRoute({
      role: "LEARNER",
      learnerProfile: { onboardingCompleted: true, goals: "Interview prep" },
    });

    expect(teacherRoute).toBe("/teacher-dashboard");
    expect(learnerRoute).toBe("/dashboard");
  });
});

