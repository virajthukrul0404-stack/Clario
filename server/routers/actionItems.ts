import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';

export const actionItemsRouter = router({
  markComplete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.actionItem.update({
        where: { id: input.id },
        data: { isCompleted: true },
      });
    }),
});
