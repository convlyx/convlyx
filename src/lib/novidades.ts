import "server-only";

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { z } from "zod/v4";
import type { UserRole } from "@/generated/prisma/enums";

// "Novidades" (What's New) posts are global editorial content authored as
// Markdown files in `content/novidades/`, NOT per-tenant database rows. One
// source of truth feeds both the in-app popover (audience-filtered, with an
// unread badge) and the public blog at /novidades. See
// docs/decisions/2026-06-07-novidades-changelog.md.

const CONTENT_DIR = path.join(process.cwd(), "content", "novidades");

/** Roles that see Novidades in-app. Students are excluded for now (see D2). */
export const NOVIDADES_STAFF_ROLES = [
  "ADMIN",
  "SECRETARY",
  "INSTRUCTOR",
] as const satisfies readonly UserRole[];

const roleSchema = z.enum(["ADMIN", "SECRETARY", "INSTRUCTOR", "STUDENT"]);

const frontmatterSchema = z.object({
  title: z.string().min(1),
  // Authored as `YYYY-MM-DD` or, for same-day badge precision, `YYYY-MM-DD HH:mm`
  // (interpreted in the server zone, i.e. UTC in prod). gray-matter may parse a
  // bare date into a Date already; a date+time usually arrives as a string.
  date: z.union([z.string(), z.date()]),
  audience: z.array(roleSchema).nonempty().optional(),
  summary: z.string().optional(),
  cover: z.string().optional(),
});

export type NovidadesPost = {
  slug: string;
  title: string;
  /** ISO date string (YYYY-MM-DD) — for display. */
  date: string;
  /**
   * Precise publish instant in ms — for sorting and the unread comparison.
   * Honours an optional `HH:mm` time in the frontmatter, so a post published
   * later on a day a user already opened the panel still counts as unread.
   * Falls back to that day's UTC midnight when no time is given.
   */
  timestamp: number;
  audience: UserRole[];
  summary: string;
  cover: string | null;
  /** Raw Markdown body (without frontmatter). */
  body: string;
};

/** Resolve a frontmatter `date` into a display day + a precise instant (ms). */
function parseDate(value: string | Date): { date: string; timestamp: number } {
  if (value instanceof Date) {
    return { date: value.toISOString().slice(0, 10), timestamp: value.getTime() };
  }
  const raw = value.trim();
  const day = raw.slice(0, 10);
  // Date-only → stable UTC midnight (no local-vs-UTC ambiguity).
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { date: day, timestamp: Date.parse(`${day}T00:00:00.000Z`) };
  }
  // Date + time (e.g. "2026-06-08 10:30") → parse the full instant.
  const ts = Date.parse(raw.replace(" ", "T"));
  return {
    date: day,
    timestamp: Number.isNaN(ts) ? Date.parse(`${day}T00:00:00.000Z`) : ts,
  };
}

/** First paragraph of the body, stripped of Markdown, capped — used when no `summary`. */
function deriveSummary(body: string): string {
  const firstPara = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .find((p) => p.length > 0 && !p.startsWith("#") && !p.startsWith("!["));
  if (!firstPara) return "";
  const plain = firstPara
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links → text
    .replace(/[*_`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > 180 ? `${plain.slice(0, 177).trimEnd()}…` : plain;
}

let cachedPosts: NovidadesPost[] | null = null;

function loadPosts(): NovidadesPost[] {
  // Cache only in production (content is fixed per deploy). In dev, re-read each
  // time so newly authored posts show up without restarting the server.
  if (cachedPosts && process.env.NODE_ENV === "production") return cachedPosts;

  let filenames: string[] = [];
  try {
    filenames = fs.readdirSync(CONTENT_DIR);
  } catch {
    // Directory may be absent (e.g. fresh checkout with no posts yet).
    cachedPosts = [];
    return cachedPosts;
  }

  const posts: NovidadesPost[] = [];
  for (const filename of filenames) {
    if (!filename.endsWith(".md")) continue;
    const raw = fs.readFileSync(path.join(CONTENT_DIR, filename), "utf8");
    const { data, content } = matter(raw);
    const parsed = frontmatterSchema.safeParse(data);
    if (!parsed.success) {
      // A malformed post must not take down the whole feed — skip it loudly.
      console.error(`[novidades] Skipping invalid frontmatter in ${filename}:`, parsed.error.message);
      continue;
    }
    const { date, timestamp } = parseDate(parsed.data.date);
    posts.push({
      slug: filename.replace(/\.md$/, ""),
      title: parsed.data.title,
      date,
      timestamp,
      audience: parsed.data.audience ?? [...NOVIDADES_STAFF_ROLES],
      summary: parsed.data.summary ?? deriveSummary(content),
      cover: parsed.data.cover ?? null,
      body: content.trim(),
    });
  }

  // Newest first; ties broken by slug for deterministic ordering.
  posts.sort((a, b) => b.timestamp - a.timestamp || b.slug.localeCompare(a.slug));
  cachedPosts = posts;
  return cachedPosts;
}

/** All posts, newest first. */
export function getAllPosts(): NovidadesPost[] {
  return loadPosts();
}

/** Posts whose audience includes the given role, newest first. */
export function getPostsForRole(role: UserRole): NovidadesPost[] {
  return loadPosts().filter((p) => p.audience.includes(role));
}

export function getPostBySlug(slug: string): NovidadesPost | null {
  return loadPosts().find((p) => p.slug === slug) ?? null;
}

/**
 * Count of posts visible to `role` that are newer than `seenAt`.
 * `seenAt` null → the user has never opened the panel, so everything is unread.
 */
export function countUnreadForRole(role: UserRole, seenAt: Date | null): number {
  const threshold = seenAt ? seenAt.getTime() : 0;
  return getPostsForRole(role).filter((p) => p.timestamp > threshold).length;
}
