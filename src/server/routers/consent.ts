import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { LEGAL_VERSIONS } from "@/lib/legal";
import {
  userTermsSatisfied,
  controllerDpaSatisfied,
  type StoredVersions,
} from "@/lib/consent";

export const consentRouter = router({
  status: protectedProcedure.query(async ({ ctx }) => {
    const [userRec, dpaRec] = await Promise.all([
      ctx.db.consentRecord.findFirst({
        where: { tenantId: ctx.tenantId, userId: ctx.user.id, type: "USER_TERMS" },
        orderBy: { acceptedAt: "desc" },
        select: { documentVersions: true },
      }),
      ctx.membership.role === "ADMIN"
        ? ctx.db.consentRecord.findFirst({
            where: { tenantId: ctx.tenantId, type: "CONTROLLER_DPA" },
            orderBy: { acceptedAt: "desc" },
            select: { documentVersions: true },
          })
        : Promise.resolve(null),
    ]);

    const needsUserTerms = !userTermsSatisfied(
      (userRec?.documentVersions as StoredVersions) ?? null,
    );
    const needsControllerDpa =
      ctx.membership.role === "ADMIN" &&
      !controllerDpaSatisfied((dpaRec?.documentVersions as StoredVersions) ?? null);

    return {
      needsUserTerms,
      needsControllerDpa,
      // isUpdate: a prior acceptance record exists but its version is now stale —
      // i.e. a re-prompt after a document version bump, not a first acceptance.
      // Lets the gate say "we updated our terms" instead of first-time copy.
      userTermsIsUpdate: needsUserTerms && userRec !== null,
      controllerDpaIsUpdate: needsControllerDpa && dpaRec !== null,
    };
  }),

  accept: protectedProcedure
    .input(z.object({ type: z.enum(["CONTROLLER_DPA", "USER_TERMS"]) }))
    .mutation(async ({ ctx, input }) => {
      if (input.type === "CONTROLLER_DPA" && ctx.membership.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "auth.insufficientPermissions",
        });
      }

      // Snapshot who accepted. Per-tenant name lives on the membership; email
      // is the global identity on the user.
      const me = await ctx.db.membership.findFirst({
        where: { tenantId: ctx.tenantId, userId: ctx.user.id },
        select: { name: true, user: { select: { email: true } } },
      });
      if (!me) {
        throw new TRPCError({ code: "NOT_FOUND", message: "users.notFound" });
      }

      const base = {
        tenantId: ctx.tenantId,
        userId: ctx.user.id,
        acceptedByEmail: me.user.email,
        acceptedByName: me.name,
        ipAddress: ctx.ip,
      };

      if (input.type === "USER_TERMS") {
        await ctx.db.consentRecord.create({
          data: {
            ...base,
            type: "USER_TERMS",
            documentVersions: { terms: LEGAL_VERSIONS.terms, privacy: LEGAL_VERSIONS.privacy },
          },
        });
        return { success: true as const };
      }

      // CONTROLLER_DPA: record the controller acceptance AND the admin's own
      // user-terms acceptance so they are never prompted twice.
      await ctx.db.$transaction([
        ctx.db.consentRecord.create({
          data: {
            ...base,
            type: "CONTROLLER_DPA",
            documentVersions: { terms: LEGAL_VERSIONS.terms, dpa: LEGAL_VERSIONS.dpa },
          },
        }),
        ctx.db.consentRecord.create({
          data: {
            ...base,
            type: "USER_TERMS",
            documentVersions: { terms: LEGAL_VERSIONS.terms, privacy: LEGAL_VERSIONS.privacy },
          },
        }),
      ]);
      return { success: true as const };
    }),
});
