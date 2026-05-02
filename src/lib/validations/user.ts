import { z } from "zod/v4";
import { LICENSE_CATEGORIES } from "@/lib/license-categories";

export const createUserSchema = z
  .object({
    email: z.email("Email inválido"),
    name: z.string().min(1, "O nome é obrigatório"),
    phone: z.string().optional(),
    role: z.enum(["ADMIN", "SECRETARY", "INSTRUCTOR", "STUDENT"]),
    schoolId: z.string().uuid(),
    // STUDENT only: initial license category to start a course in
    initialCategory: z.enum(LICENSE_CATEGORIES).optional(),
    // INSTRUCTOR only: categories the instructor is qualified to teach
    qualifiedCategories: z.array(z.enum(LICENSE_CATEGORIES)).optional(),
  })
  .refine(
    (data) => data.role !== "STUDENT" || !!data.initialCategory,
    { message: "students.categoryRequired", path: ["initialCategory"] }
  );

export const updateUserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "O nome é obrigatório"),
  phone: z.string().optional(),
  role: z.enum(["ADMIN", "SECRETARY", "INSTRUCTOR", "STUDENT"]),
  schoolId: z.string().uuid(),
  qualifiedCategories: z.array(z.enum(LICENSE_CATEGORIES)).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
