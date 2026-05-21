"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useCallback } from "react";

export function useTranslatedError() {
  const t = useTranslations();

  const onError = useCallback(
    (error: { message: string }) => {
      // Server errors are expected to carry an i18n key as their message.
      // Anything else (raw Prisma/Supabase/JS error strings, internal server
      // errors) must NOT leak to the user — fall back to a generic message
      // and log the original for diagnostics.
      if (t.has(error.message as never)) {
        toast.error(t(error.message as never));
        return;
      }
      console.warn("[trpc client] untranslated error message:", error.message);
      toast.error(t("errors.unexpected"));
    },
    [t],
  );

  return { onError };
}
