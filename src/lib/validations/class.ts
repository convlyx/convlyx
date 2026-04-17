import { z } from "zod/v4";

export const createClassSchema = z
  .object({
    schoolId: z.string().uuid(),
    classType: z.enum(["THEORY", "PRACTICAL"]),
    instructorId: z.string().uuid(),
    title: z.string().min(1, "O título é obrigatório"),
    capacity: z.number().int().min(1, "A capacidade deve ser pelo menos 1"),
    // One-off class
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
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
    (data) => {
      // Either one-off (startsAt/endsAt) or recurring, not both
      if (data.recurrence) return true;
      return new Date(data.endsAt) > new Date(data.startsAt);
    },
    { message: "A hora de fim deve ser posterior à hora de início" }
  );

export const updateClassSchema = z.object({
  id: z.string().uuid(),
  instructorId: z.string().uuid(),
  title: z.string().min(1, "O título é obrigatório"),
  capacity: z.number().int().min(1),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});

export const cancelClassSchema = z.object({
  id: z.string().uuid(),
});

export type CreateClassInput = z.infer<typeof createClassSchema>;
export type UpdateClassInput = z.infer<typeof updateClassSchema>;
