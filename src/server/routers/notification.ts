import { z } from "zod/v4";
import { router, protectedProcedure } from "../trpc";

export const notificationRouter = router({
  /** List notifications for the current user */
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(50).optional(),
        unreadOnly: z.boolean().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.notification.findMany({
        where: {
          tenantId: ctx.tenantId,
          userId: ctx.user.id,
          ...(input?.unreadOnly && { read: false }),
        },
        orderBy: { createdAt: "desc" },
        take: input?.limit ?? 20,
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          data: true,
          read: true,
          createdAt: true,
        },
      });
    }),

  /** Count unread notifications */
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.notification.count({
      where: {
        tenantId: ctx.tenantId,
        userId: ctx.user.id,
        read: false,
      },
    });
  }),

  /** Mark a notification as read */
  markRead: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.notification.updateMany({
        where: {
          id: input.id,
          userId: ctx.user.id,
          tenantId: ctx.tenantId,
        },
        data: { read: true },
      });
      return { success: true };
    }),

  /** Mark all notifications as read */
  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db.notification.updateMany({
      where: {
        userId: ctx.user.id,
        tenantId: ctx.tenantId,
        read: false,
      },
      data: { read: true },
    });
    return { success: true };
  }),
});
