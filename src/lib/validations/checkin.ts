import { z } from "zod/v4";

export const checkInSessionSchema = z.object({
  sessionId: z.string().uuid(),
});

export const studentCheckInSchema = z.object({
  sessionId: z.string().uuid(),
  token: z.string().min(1).max(64),
});

export type CheckInSessionInput = z.infer<typeof checkInSessionSchema>;
export type StudentCheckInInput = z.infer<typeof studentCheckInSchema>;
