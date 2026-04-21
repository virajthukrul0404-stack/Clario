/* Purpose: Persist session chat messages from socket server. */

import { router, publicProcedure } from "../trpc";
import { z } from "zod";

export const messagesRouter = router({
  create: publicProcedure
    .input(z.object({ roomId: z.string(), senderId: z.string(), content: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.session.findUnique({
        where: { roomIdentifier: input.roomId },
        include: { booking: { include: { teacher: true, learner: true } } },
      });

      if (!session) return null;

      // Only participants can persist
      const learnerUserId = session.booking.learner.userId;
      const teacherUserId = session.booking.teacher.userId;
      if (input.senderId !== learnerUserId && input.senderId !== teacherUserId) return null;

      return ctx.db.message.create({
        data: {
          sessionId: session.id,
          senderId: input.senderId,
          content: input.content,
        },
      });
    }),
});

