import { z } from "zod/v4";
import { LICENSE_CATEGORIES } from "@/lib/license-categories";

export const createClassSchema = z
  .object({
    schoolId: z.string().uuid(),
    classType: z.enum(["THEORY", "PRACTICAL"]),
    // Theory classes are category-agnostic (apply to all categories);
    // practical classes require a specific category.
    category: z.enum(LICENSE_CATEGORIES).optional(),
    instructorId: z.string().uuid(),
    title: z.string().min(1, "O título é obrigatório"),
    capacity: z.number().int().min(1, "A capacidade deve ser pelo menos 1"),
    // One-off class
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    // Optional: assign students directly (practical classes)
    studentIds: z.array(z.string().uuid()).max(4).optional(),
    // Optional recurrence params
    recurrence: z
      .object({
        daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
        startTime: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM"),
        endTime: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM"),
        validFrom: z.string().date(),
        validUntil: z.string().date(),
      })
      .optional(),
  })
  .refine(
    (data) => data.classType !== "PRACTICAL" || !!data.category,
    { message: "Selecione a categoria", path: ["category"] }
  )
  .refine(
    (data) => {
      // Either one-off (startsAt/endsAt) or recurring, not both
      if (data.recurrence) return true;
      return new Date(data.endsAt) > new Date(data.startsAt);
    },
    { message: "A hora de fim deve ser posterior à hora de início" }
  )
  .refine(
    (data) => {
      if (!data.recurrence) return true;
      const from = new Date(data.recurrence.validFrom);
      const until = new Date(data.recurrence.validUntil);
      const days = (until.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
      return days >= 0 && days <= 366;
    },
    { message: "O intervalo de recorrência não pode exceder 1 ano" }
  );

export const updateClassSchema = z.object({
  id: z.string().uuid(),
  instructorId: z.string().uuid(),
  // Optional — server enforces required only for practical classes (based on
  // the existing session's classType).
  category: z.enum(LICENSE_CATEGORIES).optional(),
  title: z.string().min(1, "O título é obrigatório"),
  capacity: z.number().int().min(1),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});

export const cancelClassSchema = z.object({
  id: z.string().uuid(),
});

export const listClassesSchema = z
  .object({
    schoolId: z.string().uuid().optional(),
    classType: z.enum(["THEORY", "PRACTICAL"]).optional(),
    category: z.enum(LICENSE_CATEGORIES).optional(),
    instructorId: z.string().uuid().optional(),
    status: z.enum(["ALL", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    // Pagination — when both are passed, server pages the result;
    // otherwise the full filtered set is returned (used by the calendar
    // and dashboard which need every class in their date window).
    page: z.number().int().min(1).optional(),
    pageSize: z.number().int().min(1).max(100).optional(),
    // Filters used by the classes table — searched server-side so we can
    // paginate without loading the whole tenant.
    search: z.string().optional(),
    // "upcoming" → startsAt >= now; "past" → startsAt < now. Ignored if
    // `from`/`to` are also passed (those are an explicit window).
    time: z.enum(["upcoming", "past"]).optional(),
  })
  .optional();

export type CreateClassInput = z.infer<typeof createClassSchema>;
export type UpdateClassInput = z.infer<typeof updateClassSchema>;
export type ListClassesInput = z.infer<typeof listClassesSchema>;
