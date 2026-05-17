import { z } from "zod/v4";

export const listNotificationsSchema = z
  .object({
    limit: z.number().int().min(1).max(50).optional(),
    unreadOnly: z.boolean().optional(),
  })
  .optional();

export type ListNotificationsInput = z.infer<typeof listNotificationsSchema>;
