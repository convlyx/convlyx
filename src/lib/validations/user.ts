import { z } from "zod/v4";

export const createUserSchema = z.object({
  email: z.email("Email inválido"),
  name: z.string().min(1, "O nome é obrigatório"),
  role: z.enum(["ADMIN", "SECRETARY", "INSTRUCTOR", "STUDENT"]),
  schoolId: z.string().uuid(),
  password: z.string().min(6, "A palavra-passe deve ter pelo menos 6 caracteres"),
});

export const updateUserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "O nome é obrigatório"),
  role: z.enum(["ADMIN", "SECRETARY", "INSTRUCTOR", "STUDENT"]),
  schoolId: z.string().uuid(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
