import { z } from "zod/v4";

export const createSchoolSchema = z.object({
  name: z.string().min(1, "O nome é obrigatório"),
  subdomain: z.string().min(1).regex(/^[a-z0-9-]+$/, "Apenas letras minúsculas, números e hífens"),
  address: z.string().optional(),
  phone: z.string().optional(),
});

export const updateSchoolSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "O nome é obrigatório"),
  address: z.string().optional(),
  phone: z.string().optional(),
});

export type CreateSchoolInput = z.infer<typeof createSchoolSchema>;
export type UpdateSchoolInput = z.infer<typeof updateSchoolSchema>;
