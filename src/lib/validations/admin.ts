import { z } from "zod/v4";

export const ADMIN_RANGE_DAYS = [30, 90, 365] as const;

export const adminTrendsSchema = z
  .object({
    rangeDays: z.union([z.literal(30), z.literal(90), z.literal(365)]).default(90),
  })
  .optional();

export const adminOverviewSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(120).optional(),
  status: z.enum(["ALL", "ACTIVE", "INACTIVE"]).default("ALL"),
  risk: z.enum(["ALL", "HEALTHY", "AT_RISK", "NEW", "INACTIVE"]).default("ALL"),
  sort: z.enum(["name", "createdAt", "students", "classes30d"]).default("name"),
});

export const adminAccountSchema = z.object({ tenantId: z.string().uuid() });

export const adminAccountChartsSchema = z.object({
  tenantId: z.string().uuid(),
  schoolId: z.string().uuid().optional(),
  rangeDays: z.union([z.literal(30), z.literal(90), z.literal(365)]).default(90),
});

export const adminTimelineSchema = z.object({
  tenantId: z.string().uuid(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(30),
});

// --- Operational actions (sub-project 2) ---

export const adminTenantIdSchema = z.object({ tenantId: z.string().uuid() });

export const renameTenantSchema = z.object({
  tenantId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
});

export const updateSchoolSchema = z.object({
  schoolId: z.string().uuid(),
  name: z.string().trim().min(1).max(160),
  address: z.string().trim().max(300).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  cancellationNoticeHours: z.number().int().min(0).max(168),
  practicalSelfEnrollEnabled: z.boolean(),
});

export const listStaffSchema = z.object({ schoolId: z.string().uuid() });

export const setMembershipStatusSchema = z.object({
  membershipId: z.string().uuid(),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

// --- Support view (sub-project 3) ---

export const supportListStudentsSchema = z.object({
  tenantId: z.string().uuid(),
  schoolId: z.string().uuid().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
});

export const supportGetStudentSchema = z.object({
  tenantId: z.string().uuid(),
  studentUserId: z.string().uuid(),
});

export const supportLookupSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export const resetPasswordSchema = z.object({ membershipId: z.string().uuid() });
