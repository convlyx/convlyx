"use client";

import { useState, useEffect } from "react";
import { useTranslations, useFormatter } from "next-intl";
import * as Popover from "@radix-ui/react-popover";
import { Bell, CheckCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/loading";
import { createClient } from "@/lib/supabase/client";

/** Resolve a notification's stored params, handling nested translation keys */
function useNotificationText(
  t: ReturnType<typeof useTranslations>,
  key: string,
  data: unknown
) {
  const params = (data ?? {}) as Record<string, string>;

  // Resolve nested translation keys in params (e.g. status: "ATTENDED" → "presente")
  const resolvedParams: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (k === "status" && (v === "ATTENDED" || v === "NO_SHOW")) {
      resolvedParams[k] = v === "ATTENDED"
        ? t("notifications.statusAttended")
        : t("notifications.statusNoShow");
    } else {
      resolvedParams[k] = v;
    }
  }

  try {
    return t(key, resolvedParams);
  } catch {
    // Fallback if key doesn't exist — show the raw key
    return key;
  }
}

export function NotificationBell({ userId }: { userId: string }) {
  const t = useTranslations();
  const format = useFormatter();
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();

  const { data: unreadCount } = trpc.notification.unreadCount.useQuery(undefined, {
    refetchInterval: 30000,
  });

  const { data: notifications, isLoading: notificationsLoading } = trpc.notification.list.useQuery(
    { limit: 15 },
    { enabled: open }
  );

  const markReadMutation = trpc.notification.markRead.useMutation({
    onSuccess: () => {
      utils.notification.unreadCount.invalidate();
      utils.notification.list.invalidate();
    },
  });

  const markAllReadMutation = trpc.notification.markAllRead.useMutation({
    onSuccess: () => {
      utils.notification.unreadCount.invalidate();
      utils.notification.list.invalidate();
    },
  });

  // Supabase Realtime
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          utils.notification.unreadCount.invalidate();
          if (open) {
            utils.notification.list.invalidate();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, open, utils]);

  const count = unreadCount ?? 0;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          title={t("notifications.title")}
        >
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white px-1">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          collisionPadding={8}
          className="z-[200] w-80 max-h-96 rounded-xl border bg-popover shadow-lg outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 flex flex-col overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
            <h3 className="text-sm font-semibold">{t("notifications.title")}</h3>
            {count > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                disabled={markAllReadMutation.isPending}
                onClick={() => markAllReadMutation.mutate()}
              >
                <CheckCheck className="h-3 w-3" />
                {t("notifications.markAllRead")}
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {notificationsLoading ? (
              <Loading />
            ) : !notifications || notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Bell className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-xs">{t("notifications.empty")}</p>
              </div>
            ) : (
              <div className="divide-y">
                {notifications.map((n) => (
                  <NotificationItem
                    key={n.id}
                    notification={n}
                    t={t}
                    format={format}
                    onMarkRead={() => {
                      if (!n.read) markReadMutation.mutate({ id: n.id });
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function NotificationItem({
  notification: n,
  t,
  format,
  onMarkRead,
}: {
  notification: {
    id: string;
    title: string;
    message: string;
    data: unknown;
    read: boolean;
    createdAt: Date;
  };
  t: ReturnType<typeof useTranslations>;
  format: ReturnType<typeof useFormatter>;
  onMarkRead: () => void;
}) {
  const title = useNotificationText(t, n.title, n.data);
  const message = useNotificationText(t, n.message, n.data);

  return (
    <button
      type="button"
      onClick={onMarkRead}
      className={`w-full text-left px-4 py-3 transition-colors cursor-pointer hover:bg-muted/50 ${
        !n.read ? "bg-primary/5" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        {!n.read && (
          <span className="mt-1.5 flex h-2 w-2 shrink-0 rounded-full bg-primary" />
        )}
        <div className={`flex-1 min-w-0 ${n.read ? "pl-4" : ""}`}>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{message}</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            {format.relativeTime(new Date(n.createdAt))}
          </p>
        </div>
      </div>
    </button>
  );
}
