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

export const listUsersSchema = z
  .object({
    schoolId: z.string().uuid().optional(),
    role: z.enum(["ADMIN", "SECRETARY", "INSTRUCTOR", "STUDENT"]).optional(),
    // Multi-role filter — used by the /staff list to fetch ADMIN + SECRETARY
    // in a single query. If both `role` and `roles` are supplied, `role` wins.
    roles: z.array(z.enum(["ADMIN", "SECRETARY", "INSTRUCTOR", "STUDENT"])).optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
    // Server-side pagination — when both are passed, server pages the
    // result. Otherwise the full filtered set is returned (used by
    // dropdowns, instructor pickers, etc. which need every match).
    page: z.number().int().min(1).optional(),
    pageSize: z.number().int().min(1).max(100).optional(),
    // Filters used by the staff list pages — searched server-side so we
    // can paginate without loading the whole tenant.
    search: z.string().optional(),
    // Only meaningful when `role: "STUDENT"`. Filters by the student's
    // currently in-progress course category.
    category: z.enum(LICENSE_CATEGORIES).optional(),
  })
  .optional();

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ListUsersInput = z.infer<typeof listUsersSchema>;
