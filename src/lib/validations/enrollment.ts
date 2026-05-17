import { z } from "zod/v4";

export const enrollSchema = z.object({
  sessionId: z.string().uuid(),
  studentId: z.string().uuid().optional(), // Admin/secretary can enroll others
});

export const markAttendanceSchema = z.object({
  enrollmentId: z.string().uuid(),
  status: z.enum(["ATTENDED", "NO_SHOW"]),
});

export const addNoteSchema = z.object({
  enrollmentId: z.string().uuid(),
  notes: z.string().max(2000),
});

export const bulkSetAttendanceSchema = z.object({
  sessionId: z.string().uuid(),
  entries: z
    .array(
      z.object({
        enrollmentId: z.string().uuid(),
        status: z.enum(["ATTENDED", "NO_SHOW"]),
      }),
    )
    .min(1),
});

export const bulkMarkAttendanceSchema = z.object({
  sessionId: z.string().uuid(),
  status: z.enum(["ATTENDED", "NO_SHOW"]),
});

export const listByStudentSchema = z
  .object({
    studentId: z.string().uuid().optional(),
    // Pagination — when both passed, server pages. Otherwise all matching
    // rows are returned (used by calendar/dashboards/classes-table).
    page: z.number().int().min(1).optional(),
    pageSize: z.number().int().min(1).max(100).optional(),
    // Time slice: "current" → still ENROLLED and the class is in the
    // future; "past" → anything else (cancelled, attended, no-show, or
    // session already started).
    time: z.enum(["current", "past"]).optional(),
  })
  .optional();

export type EnrollInput = z.infer<typeof enrollSchema>;
export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;
export type AddNoteInput = z.infer<typeof addNoteSchema>;
export type BulkSetAttendanceInput = z.infer<typeof bulkSetAttendanceSchema>;
export type BulkMarkAttendanceInput = z.infer<typeof bulkMarkAttendanceSchema>;
export type ListByStudentInput = z.infer<typeof listByStudentSchema>;
