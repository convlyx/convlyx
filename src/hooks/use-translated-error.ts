"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useCallback } from "react";

export function useTranslatedError() {
  const t = useTranslations();

  const onError = useCallback(
    (error: { message: string }) => {
      const msg = t.has(error.message as never)
        ? t(error.message as never)
        : error.message;
      toast.error(msg);
    },
    [t],
  );

  return { onError };
}
