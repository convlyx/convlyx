import { z } from "zod/v4";

export const scheduleExamSchema = z.object({
  courseId: z.string().uuid(),
  type: z.enum(["THEORY", "PRACTICAL"]),
  scheduledAt: z.string().datetime(),
  location: z.string().max(200).optional(),
  instructorId: z.string().uuid().optional(),
});

export const updateExamSchema = z.object({
  id: z.string().uuid(),
  scheduledAt: z.string().datetime(),
  location: z.string().max(200).optional(),
  instructorId: z.string().uuid().optional(),
});

export const recordExamResultSchema = z.object({
  id: z.string().uuid(),
  result: z.enum(["PASSED", "FAILED", "NO_SHOW", "CANCELLED"]),
  examinerNotes: z.string().max(2000).optional(),
});

export const cancelExamSchema = z.object({
  id: z.string().uuid(),
});

export type ScheduleExamInput = z.infer<typeof scheduleExamSchema>;
export type UpdateExamInput = z.infer<typeof updateExamSchema>;
export type RecordExamResultInput = z.infer<typeof recordExamResultSchema>;
