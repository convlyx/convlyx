import { z } from "zod/v4";
import { router, protectedProcedure } from "../trpc";
import { getPostsForRole, countUnreadForRole } from "@/lib/novidades";

// "Novidades" are global Markdown posts (see src/lib/novidades.ts). This router
// only adds the per-user concern: which posts are unread, and stamping "seen".
export const novidadesRouter = router({
  /** Posts for the current user's role + how many are unread since they last looked. */
  feed: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const me = await ctx.db.user.findFirst({
        where: { id: ctx.user.id, tenantId: ctx.tenantId },
        select: { novidadesSeenAt: true },
      });

      const seenAt = me?.novidadesSeenAt ?? null;
      const all = getPostsForRole(ctx.user.role);
      const unreadCount = countUnreadForRole(ctx.user.role, seenAt);
      const threshold = seenAt ? seenAt.getTime() : 0;

      const posts = all.slice(0, input?.limit ?? 8).map((p) => ({
        slug: p.slug,
        title: p.title,
        date: p.date,
        summary: p.summary,
        unread: p.timestamp > threshold,
      }));

      return { posts, unreadCount };
    }),

  /** Mark all Novidades as seen for the current user (clears the unread badge). */
  markSeen: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db.user.updateMany({
      where: { id: ctx.user.id, tenantId: ctx.tenantId },
      data: { novidadesSeenAt: new Date() },
    });
    return { success: true };
  }),
});
