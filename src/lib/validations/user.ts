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

// Bulk student import. The client parses the spreadsheet, maps columns, and
// resolves each row's category (mapped value or batch default) before sending
// — so every row arrives as a clean student record. Role is implicitly STUDENT
// (set server-side). The 200-row cap guards against abuse / runaway imports; a
// real roster is tens of rows.
export const bulkStudentRowSchema = z.object({
  name: z.string().min(1, "O nome é obrigatório"),
  email: z.email("Email inválido"),
  phone: z.string().optional(),
  category: z.enum(LICENSE_CATEGORIES),
});

export const bulkCreateStudentsSchema = z.object({
  schoolId: z.string().uuid(),
  students: z.array(bulkStudentRowSchema).min(1).max(200),
});

export const checkExistingEmailsSchema = z.object({
  emails: z.array(z.email()).max(200),
});

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
    // Merge each user's email-confirmation status from Supabase Auth. This is
    // an external `listUsers` call, so it's opt-in — only the management list
    // pages that render the "confirmed/pending" indicator need it; filters,
    // pickers and dropdowns leave it off.
    includeAuthStatus: z.boolean().optional(),
  })
  .optional();

// Paginated enrollment history for the student detail page. When `page`
// is omitted, the full set is returned (used by the PDF export path).
export const listStudentEnrollmentsSchema = z.object({
  id: z.string().uuid(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
});

// Paginated class history for the instructor detail page.
export const listInstructorSessionsSchema = z.object({
  id: z.string().uuid(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type BulkStudentRow = z.infer<typeof bulkStudentRowSchema>;
export type BulkCreateStudentsInput = z.infer<typeof bulkCreateStudentsSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ListUsersInput = z.infer<typeof listUsersSchema>;
export type ListStudentEnrollmentsInput = z.infer<typeof listStudentEnrollmentsSchema>;
export type ListInstructorSessionsInput = z.infer<typeof listInstructorSessionsSchema>;
