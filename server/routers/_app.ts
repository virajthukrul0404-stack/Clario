import { router, publicProcedure } from "../trpc";
import { usersRouter } from "./users";
import { actionItemsRouter } from "./actionItems";
import { teachersRouter } from "./teachers";
import { bookingsRouter } from "./bookings";
import { sessionsRouter } from "./sessions";
import { notificationsRouter } from "./notifications";
import { messagesRouter } from "./messages";

const searchRouter = router({
  ping: publicProcedure.query(() => ({ ok: true })),
});

const aiRouter = router({
  ping: publicProcedure.query(() => ({ ok: true })),
});

export const appRouter = router({
  users: usersRouter,
  actionItems: actionItemsRouter,
  teachers: teachersRouter,
  bookings: bookingsRouter,
  sessions: sessionsRouter,
  notifications: notificationsRouter,
  messages: messagesRouter,
  search: searchRouter,
  ai: aiRouter,
});

export type AppRouter = typeof appRouter;
