"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

/**
 * One-time blocking gate. Renders a full-screen overlay when the current user
 * still needs to accept documents. Admins with no controller DPA see the DPA
 * variant (which records both controller + their user terms); everyone else
 * sees the user-terms variant. Nothing renders once acceptance is satisfied.
 */
export function ConsentGate() {
  const t = useTranslations("consent");
  const utils = trpc.useUtils();
  const { data } = trpc.consent.status.useQuery(undefined, { staleTime: Infinity });
  const accept = trpc.consent.accept.useMutation({
    onSuccess: async () => {
      await utils.consent.status.invalidate();
    },
    onError: () => toast.error(t("error")),
  });

  if (!data) return null;
  const kind = data.needsControllerDpa ? "controller" : data.needsUserTerms ? "user" : null;
  if (!kind) return null;

  const type = kind === "controller" ? "CONTROLLER_DPA" : "USER_TERMS";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-lg space-y-4">
        <h2 id="consent-title" className="text-lg font-semibold">
          {kind === "controller" ? t("controllerTitle") : t("userTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {kind === "controller" ? t("controllerBody") : t("userBody")}
        </p>
        <ul className="text-sm space-y-1">
          <li>
            <Link href="/termos-e-condicoes" target="_blank" className="text-primary hover:underline">
              {t("terms")}
            </Link>
          </li>
          {kind === "controller" ? (
            <li>
              <Link href="/contrato-de-subcontratacao" target="_blank" className="text-primary hover:underline">
                {t("dpa")}
              </Link>
            </li>
          ) : (
            <li>
              <Link href="/politica-de-privacidade" target="_blank" className="text-primary hover:underline">
                {t("privacy")}
              </Link>
            </li>
          )}
        </ul>
        <Button
          className="w-full"
          disabled={accept.isPending}
          onClick={() => accept.mutate({ type })}
        >
          {accept.isPending ? t("accepting") : t("accept")}
        </Button>
      </div>
    </div>
  );
}
