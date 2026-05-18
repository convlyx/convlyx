"use client";

import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { Award } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell,
} from "recharts";

import type { AnalyticsRangeDays } from "@/lib/validations/analytics";

export function PassRateByCategory({
  rangeDays,
  schoolId,
}: {
  rangeDays: AnalyticsRangeDays;
  schoolId?: string;
}) {
  const t = useTranslations();
  const { data, isLoading } = trpc.analytics.passRateByCategory.useQuery({
    rangeDays,
    ...(schoolId && { schoolId }),
  });

  const rows = data?.map((d) => ({
    category: d.category,
    pct: Math.round(d.passRate * 100),
    attempts: d.attempts,
    passed: d.passed,
  })) ?? [];

  // Colour each bar by its rate: green for healthy, amber for marginal,
  // destructive for weak. Visual reinforces what the number already says.
  const barColour = (pct: number): string => {
    if (pct >= 75) return "#10b981";
    if (pct >= 50) return "#f59e0b";
    return "var(--destructive)";
  };

  return (
    <section className="rounded-xl border bg-card p-5 card-shadow space-y-4 animate-in fade-in duration-300">
      <div>
        <h2 className="text-lg font-semibold">{t("analytics.passRateByCategory")}</h2>
        <p className="text-sm text-muted-foreground">{t(`analytics.range.${rangeDays}`)}</p>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState icon={Award} message={t("analytics.noData")} />
      ) : (
        <div className="w-full" style={{ height: Math.max(96, rows.length * 44 + 32) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={rows}
              margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis
                type="number"
                stroke="var(--muted-foreground)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                domain={[0, 100]}
                unit="%"
              />
              <YAxis
                type="category"
                dataKey="category"
                stroke="var(--muted-foreground)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                width={48}
              />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.3 }}
                contentStyle={{
                  backgroundColor: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: "0.5rem",
                  fontSize: "0.875rem",
                }}
                labelStyle={{ color: "var(--foreground)" }}
                formatter={(value, _name, item) => {
                  const r = item?.payload as { attempts: number; passed: number } | undefined;
                  return r
                    ? [`${value}% (${r.passed}/${r.attempts})`, t("analytics.passRate")]
                    : [`${value}%`, t("analytics.passRate")];
                }}
              />
              <Bar dataKey="pct" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                {rows.map((r, i) => (
                  <Cell key={i} fill={barColour(r.pct)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
