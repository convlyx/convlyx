import { z } from "zod/v4";
import { LICENSE_CATEGORIES } from "@/lib/license-categories";

export const startCourseSchema = z.object({
  studentId: z.string().uuid(),
  category: z.enum(LICENSE_CATEGORIES),
});

export const completeCourseSchema = z.object({
  id: z.string().uuid(),
});

export const abandonCourseSchema = z.object({
  id: z.string().uuid(),
});

export type StartCourseInput = z.infer<typeof startCourseSchema>;
