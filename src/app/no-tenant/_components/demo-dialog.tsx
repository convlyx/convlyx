"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { COMPANY } from "@/lib/company";

const demoFormSchema = z.object({
  email: z.string().trim().email("invalidEmail").max(200),
  phone: z.string().trim().max(40).optional(),
  schoolName: z.string().trim().min(1, "required").max(160),
  message: z.string().trim().max(2000).optional(),
  // Honeypot — hidden field. Bots fill it; real users leave empty.
  website: z.string().max(0).optional(),
});

type DemoFormData = z.infer<typeof demoFormSchema>;

export function DemoDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("landing.demoForm");
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DemoFormData>({
    resolver: zodResolver(demoFormSchema),
    defaultValues: {
      email: "",
      phone: "",
      schoolName: "",
      message: "",
      website: "",
    },
  });

  async function onSubmit(data: DemoFormData) {
    try {
      const res = await fetch("/api/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("send failed");
      setSubmitted(true);
      toast.success(t("successToast"));
    } catch {
      toast.error(t("errorToast", { email: COMPANY.contactEmail }));
    }
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) {
      // Reset state after the close animation finishes.
      setTimeout(() => {
        reset();
        setSubmitted(false);
      }, 200);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {submitted ? (
          <>
            <DialogHeader>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary mb-2">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <DialogTitle className="text-center text-lg">
                {t("successTitle")}
              </DialogTitle>
              <DialogDescription className="text-center">
                {t("successMessage")}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)} className="w-full">
                {t("close")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            <DialogHeader>
              <DialogTitle>{t("title")}</DialogTitle>
              <DialogDescription className="mb-4">{t("description")}</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="demo-email">{t("emailLabel")}</Label>
                  <Input
                    id="demo-email"
                    type="email"
                    autoComplete="email"
                    {...register("email")}
                  />
                  {errors.email && (
                    <p className="text-xs text-destructive">{t("emailInvalid")}</p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="demo-phone">{t("phoneLabel")}</Label>
                  <Input
                    id="demo-phone"
                    type="tel"
                    autoComplete="tel"
                    {...register("phone")}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="demo-school">{t("schoolLabel")}</Label>
                  <Input
                    id="demo-school"
                    autoComplete="organization"
                    {...register("schoolName")}
                  />
                  {errors.schoolName && (
                    <p className="text-xs text-destructive">{t("schoolRequired")}</p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="demo-message">{t("messageLabel")}</Label>
                  <Textarea
                    id="demo-message"
                    rows={3}
                    placeholder={t("messagePlaceholder")}
                    {...register("message")}
                  />
                </div>
                {/* Honeypot — hidden from humans, attractive to bots */}
                <input
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="hidden"
                  {...register("website")}
                />
              </div>
            </DialogBody>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
              >
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={isSubmitting} className="gap-1.5">
                {isSubmitting ? t("submitting") : t("submit")}
                {!isSubmitting && <ArrowRight className="h-3.5 w-3.5" />}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
