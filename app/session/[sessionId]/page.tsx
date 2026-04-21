import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import SessionRoom from "@/components/session/SessionRoom";
import { findSessionByRouteParamWithInclude } from "@/lib/session-lookup";

export const dynamic = "force-dynamic";

export default async function SessionPage({
  params,
}: {
  params: { sessionId: string };
}) {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const session = await findSessionByRouteParamWithInclude(params.sessionId, {
    booking: {
      include: {
        teacher: { include: { user: true } },
        learner: { include: { user: true } },
      },
    },
    messages: {
      orderBy: { createdAt: "asc" },
      take: 50,
    },
  });

  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-500">
        Session not found
      </div>
    );
  }

  const serializedSession = JSON.parse(JSON.stringify(session));

  return <SessionRoom session={serializedSession} currentUserId={user.id} />;
}
