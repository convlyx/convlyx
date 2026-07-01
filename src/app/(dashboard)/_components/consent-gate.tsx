"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

/**
 * Two-tier consent surface, driven by trpc.consent.status:
 *
 * - CONTROLLER (school admin, needs the Art. 28 DPA): a blocking, one-time
 *   accept-to-continue modal. The DPA is contract formation, so an explicit
 *   "Aceito" is worth the friction (and it's rare — once per school).
 *
 * - USERS (student / instructor / secretary, need Terms + Privacy): a
 *   NON-blocking, dismissible banner. The privacy policy is an information duty
 *   (RGPD Art. 13/14), not a consent gate, so we surface + record acceptance
 *   without walling the app. "Aceitar" records; the X hides it for now (it
 *   returns on next load until accepted).
 *
 * Renders nothing once the current user's obligations are satisfied.
 */
export function ConsentGate() {
  const t = useTranslations("consent");
  const utils = trpc.useUtils();
  const { data } = trpc.consent.status.useQuery(undefined, { staleTime: Infinity });
  const [dismissed, setDismissed] = useState(false);
  const accept = trpc.consent.accept.useMutation({
    onSuccess: async () => {
      await utils.consent.status.invalidate();
    },
    onError: () => toast.error(t("error")),
  });

  if (!data) return null;

  // Tier 1 — admin DPA: blocking modal.
  if (data.needsControllerDpa) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-title"
        className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      >
        <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-lg space-y-4">
          <h2 id="consent-title" className="text-lg font-semibold">
            {data.controllerDpaIsUpdate ? t("controllerUpdateTitle") : t("controllerTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {data.controllerDpaIsUpdate ? t("controllerUpdateBody") : t("controllerBody")}
          </p>
          <ul className="text-sm space-y-1">
            <li>
              <Link href="/termos-e-condicoes" target="_blank" className="text-primary hover:underline">
                {t("terms")}
              </Link>
            </li>
            <li>
              <Link href="/contrato-de-subcontratacao" target="_blank" className="text-primary hover:underline">
                {t("dpa")}
              </Link>
            </li>
          </ul>
          <Button
            className="w-full"
            disabled={accept.isPending}
            onClick={() => accept.mutate({ type: "CONTROLLER_DPA" })}
          >
            {accept.isPending ? t("accepting") : t("accept")}
          </Button>
        </div>
      </div>
    );
  }

  // Tier 2 — user Terms + Privacy: non-blocking dismissible banner.
  if (data.needsUserTerms && !dismissed) {
    return (
      <div
        role="region"
        aria-label={t("userTitle")}
        className="mb-4 flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-sm sm:flex-row sm:items-center sm:p-4"
      >
        <p className="flex-1 text-sm text-muted-foreground">
          {data.userTermsIsUpdate ? t("bannerUpdateBody") : t("bannerBody")}{" "}
          <Link href="/termos-e-condicoes" target="_blank" className="text-primary hover:underline">
            {t("terms")}
          </Link>
          {" · "}
          <Link href="/politica-de-privacidade" target="_blank" className="text-primary hover:underline">
            {t("privacy")}
          </Link>
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" disabled={accept.isPending} onClick={() => accept.mutate({ type: "USER_TERMS" })}>
            {accept.isPending ? t("accepting") : t("ack")}
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={t("dismiss")} onClick={() => setDismissed(true)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
