"use client";

import { useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import * as Popover from "@radix-ui/react-popover";
import { Newspaper, ArrowRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Loading } from "@/components/loading";
import type { UserRole } from "@/generated/prisma/enums";

/**
 * The public Novidades blog lives on the ROOT domain (convlyx.com), not on a
 * tenant subdomain (demo.convlyx.com). Strip a leading tenant label from the
 * current host so links open the canonical public URL — and so the blog's
 * footer (root-relative SEO/legal links) resolves correctly.
 */
function computeRootOrigin(): string {
  if (typeof window === "undefined") return "https://convlyx.com";
  const { protocol, hostname, port } = window.location;
  let rootHost: string;
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    rootHost = "localhost";
  } else {
    const parts = hostname.split(".");
    rootHost = parts.length >= 3 ? parts.slice(1).join(".") : hostname;
  }
  return `${protocol}//${rootHost}${port ? `:${port}` : ""}`;
}

/**
 * "Novidades" (What's New) panel — a sibling of the notification bell that
 * surfaces product changelog posts. Staff-only (hidden for students). Content
 * is global Markdown (see src/lib/novidades.ts); this just shows the
 * role-filtered feed and an unread badge driven by `novidadesSeenAt`. Posts
 * open in a new tab on the public root-domain blog.
 */
export function NovidadesButton({ userRole }: { userRole: UserRole }) {
  const t = useTranslations("novidades");
  const format = useFormatter();
  const [open, setOpen] = useState(false);
  // Resolved once per mount. On the server this returns the prod default; on the
  // client it returns the live host. It isn't part of any server-rendered DOM
  // (the popover is closed/portaled), so there's no hydration mismatch.
  const [rootOrigin] = useState(computeRootOrigin);
  const utils = trpc.useUtils();

  const { data, isLoading, isError } = trpc.novidades.feed.useQuery({ limit: 8 });

  const markSeen = trpc.novidades.markSeen.useMutation({
    onSuccess: () => utils.novidades.feed.invalidate(),
  });

  // Students don't see Novidades for now (see decision D2).
  if (userRole === "STUDENT") return null;

  const unread = data?.unreadCount ?? 0;
  const posts = data?.posts ?? [];

  function handleOpenChange(next: boolean) {
    setOpen(next);
    // Opening the panel marks everything seen: non-invasive, no extra click.
    if (next && unread > 0 && !markSeen.isPending) markSeen.mutate();
  }

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <button
          className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          title={t("title")}
        >
          <Newspaper className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground px-1">
              {unread > 9 ? "9+" : unread}
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
          <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
            <Newspaper className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">{t("title")}</h3>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <Loading />
            ) : isError ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Newspaper className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-xs">{t("error")}</p>
              </div>
            ) : posts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Newspaper className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-xs">{t("empty")}</p>
              </div>
            ) : (
              <ul className="divide-y">
                {posts.map((post) => (
                  <li key={post.slug}>
                    <a
                      href={`${rootOrigin}/novidades/${post.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setOpen(false)}
                      className="block px-4 py-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-start gap-2">
                        {post.unread && (
                          <span className="mt-1.5 flex h-2 w-2 shrink-0 rounded-full bg-primary" />
                        )}
                        <div className={`flex-1 min-w-0 ${post.unread ? "" : "pl-4"}`}>
                          <p className="text-sm font-medium">{post.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {post.summary}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {format.dateTime(new Date(`${post.date}T00:00:00`), {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <a
            href={`${rootOrigin}/novidades`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-1.5 px-4 py-3 border-t text-xs font-medium text-primary hover:bg-muted/50 transition-colors shrink-0"
          >
            {t("seeAll")}
            <ArrowRight className="h-3 w-3" />
          </a>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
