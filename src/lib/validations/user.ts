import { z } from "zod/v4";

export const createUserSchema = z.object({
  email: z.email("Email inválido"),
  name: z.string().min(1, "O nome é obrigatório"),
  role: z.enum(["ADMIN", "SECRETARY", "INSTRUCTOR", "STUDENT"]),
  schoolId: z.string().uuid(),
});

export const updateUserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "O nome é obrigatório"),
  role: z.enum(["ADMIN", "SECRETARY", "INSTRUCTOR", "STUDENT"]),
  schoolId: z.string().uuid(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
