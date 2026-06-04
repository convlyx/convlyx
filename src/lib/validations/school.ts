import { z } from "zod/v4";

/**
 * Timezones a Portuguese driving school can operate in. Mainland and Madeira
 * share Lisbon time; the Azores are one hour behind. Used both for input
 * validation and to populate the settings selector.
 */
export const SCHOOL_TIME_ZONES = ["Europe/Lisbon", "Atlantic/Madeira", "Atlantic/Azores"] as const;
export type SchoolTimeZone = (typeof SCHOOL_TIME_ZONES)[number];

export const createSchoolSchema = z.object({
  name: z.string().min(1, "O nome é obrigatório"),
  subdomain: z.string().min(1).regex(/^[a-z0-9-]+$/, "Apenas letras minúsculas, números e hífens"),
  address: z.string().optional(),
  phone: z.string().optional(),
  // Timezone is fixed at creation and never edited afterwards — changing it
  // would shift the wall-clock of every already-stored class/exam.
  timeZone: z.enum(SCHOOL_TIME_ZONES),
});

export const updateSchoolSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "O nome é obrigatório"),
  address: z.string().optional(),
  phone: z.string().optional(),
  cancellationNoticeHours: z.number().int().min(0).max(168).optional(),
  practicalSelfEnrollEnabled: z.boolean().optional(),
});

export type CreateSchoolInput = z.infer<typeof createSchoolSchema>;
export type UpdateSchoolInput = z.infer<typeof updateSchoolSchema>;
