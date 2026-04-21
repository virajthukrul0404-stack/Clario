export const dynamic = 'force-dynamic';

// Purpose: Post-auth redirect that ensures DB user exists, then routes based on onboarding state.
// Prereq: Clerk auth must be configured; Prisma `User.imageUrl` stores Clerk imageUrl.
import { redirect } from "next/navigation";
import { normalizeClerkEnv } from "@/lib/normalize-clerk-env";
import { db } from "@/lib/db";
import { resolvePostAuthRoute } from "@/lib/auth-routing";
import { isDatabaseConfigured } from "@/lib/database-config";

function normalizeEmail(email: string | null | undefined, userId: string) {
  return email ?? `temp-${userId}@example.com`;
}

type PostAuthSearchParams = {
  role?: string;
};

export default async function PostAuthPage({
  searchParams,
}: {
  searchParams?: PostAuthSearchParams;
}) {
  normalizeClerkEnv();
  const { auth, currentUser } = await import("@clerk/nextjs/server");
  const desiredRole =
    searchParams?.role === "LEARNER" || searchParams?.role === "TEACHER"
      ? searchParams.role
      : null;
  const onboardingUrl = desiredRole
    ? `/onboarding?role=${desiredRole}`
    : "/onboarding";
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!isDatabaseConfigured()) redirect(onboardingUrl);

  const clerkUser = await currentUser();
  if (!clerkUser) redirect("/sign-in");

  const email = normalizeEmail(clerkUser.emailAddresses?.[0]?.emailAddress, userId);
  const firstName = clerkUser.firstName ?? "";
  const lastName = clerkUser.lastName ?? "";
  const imageUrl = clerkUser.imageUrl ?? null;

  // Ensure we always have a DB record after auth.
  const synced = await db.user
    .upsert({
      where: { id: userId },
      create: {
        id: userId,
        email,
        firstName,
        lastName,
        imageUrl,
      },
      update: {
        email,
        firstName,
        lastName,
        imageUrl,
      },
    })
    .then(() => true)
    .catch(() => false);

  if (!synced) redirect(onboardingUrl);

  const user = await db.user
    .findUnique({
      where: { id: userId },
      include: {
        learnerProfile: true,
        teacherProfile: true,
      },
    })
    .catch(() => null);

  if (!user) redirect(onboardingUrl);

  // If role hasn't been picked yet (no profile rows), do the lightweight role selection once.
  if (!user.learnerProfile && !user.teacherProfile) {
    redirect(onboardingUrl);
  }

  redirect(resolvePostAuthRoute(user));
}
