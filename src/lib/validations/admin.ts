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
  cursor: z.string().datetime().optional(),
});
