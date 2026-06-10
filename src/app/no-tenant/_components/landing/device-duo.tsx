"use client";

import { useState } from "react";

/**
 * Hero product visual: a laptop showing the backoffice and an overlapping
 * phone showing the mobile app. Real screenshots from /public/screenshots/
 * with a styled fallback when the files are absent (same pattern as the
 * showcase frames).
 */
export function DeviceDuo({
  laptopAlt,
  phoneAlt,
}: {
  laptopAlt: string;
  phoneAlt: string;
}) {
  const [hasLaptop, setHasLaptop] = useState(true);
  const [hasPhone, setHasPhone] = useState(true);

  return (
    <div className="relative mx-auto w-full max-w-[480px] pt-6">
      {/* Dot-grid texture behind the devices (peeks around their edges) */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-10 z-0"
        style={{
          backgroundImage:
            "radial-gradient(color-mix(in srgb, var(--landing-forest) 38%, transparent) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          WebkitMaskImage: "radial-gradient(ellipse at 50% 45%, black 55%, transparent 82%)",
          maskImage: "radial-gradient(ellipse at 50% 45%, black 55%, transparent 82%)",
        }}
      />
      {/* Soft neutral ambient shadow behind the devices, so they lift off the
          sage cleanly without a competing colour. */}
      <div aria-hidden className="pointer-events-none absolute -inset-6 z-0 flex items-center justify-center">
        <div className="h-full w-full translate-y-6 rounded-[50%] bg-[radial-gradient(circle_at_50%_55%,rgba(15,23,42,0.5),rgba(15,23,42,0.22)_46%,transparent_70%)] blur-2xl" />
      </div>

      {/* Laptop — in flow, defines the height (no leftover empty space) */}
      <div className="relative z-10 w-[88%]">
        <div className="overflow-hidden rounded-t-xl border-[8px] border-b-0 border-[#1f2937] bg-[#f4f7f4] shadow-[0_40px_80px_-22px_rgba(15,23,42,0.6)]">
          <div className="aspect-[16/10]">
            {hasLaptop ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="/screenshots/bo-dashboard.png"
                alt={laptopAlt}
                loading="lazy"
                className="h-full w-full object-cover object-top"
                onError={() => setHasLaptop(false)}
              />
            ) : (
              <LaptopFallback />
            )}
          </div>
        </div>
        {/* Base */}
        <div className="h-2.5 rounded-b-sm bg-[#1f2937]" />
        <div className="-ml-[6%] h-1.5 w-[112%] rounded-b-xl bg-[#374151]" />
      </div>

      {/* Phone — bigger, overlapping the lower-right of the laptop, raised in front */}
      <div className="absolute -right-1 bottom-[-28%] z-10 w-[33%] max-w-[148px]">
        <div className="relative overflow-hidden rounded-[2rem] border-[6px] border-[#1f2937] bg-[#1f2937] shadow-[0_30px_60px_-16px_rgba(15,23,42,0.7)]">
          {/* Notch — flush with the top bezel */}
          <div className="absolute top-0 left-1/2 z-10 h-2.5 w-[40%] -translate-x-1/2 rounded-b-xl bg-[#1f2937]" />
          <div className="aspect-[9/19] overflow-hidden rounded-[1.5rem] bg-[#f4f7f4]">
            {hasPhone ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="/screenshots/app-home.png"
                alt={phoneAlt}
                loading="lazy"
                className="h-full w-full object-cover object-top"
                onError={() => setHasPhone(false)}
              />
            ) : (
              <PhoneFallback />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LaptopFallback() {
  return (
    <div className="flex h-full w-full">
      <div className="w-[18%] bg-[var(--landing-forest)] p-1.5">
        <div className="mb-1.5 h-3 w-full rounded bg-white/90" />
        <div className="mb-1.5 h-3 w-full rounded bg-white/20" />
        <div className="mb-1.5 h-3 w-full rounded bg-white/20" />
        <div className="h-3 w-full rounded bg-white/20" />
      </div>
      <div className="flex-1 p-2">
        <div className="mb-2 grid grid-cols-3 gap-1.5">
          <FallbackStat value="12" />
          <FallbackStat value="48" />
          <FallbackStat value="94%" warm />
        </div>
        <FallbackRow color="#60a5fa" />
        <FallbackRow color="#16a34a" />
        <FallbackRow color="#60a5fa" />
      </div>
    </div>
  );
}

function FallbackStat({ value, warm = false }: { value: string; warm?: boolean }) {
  return (
    <div className="rounded-md bg-white p-1.5 shadow-sm">
      <div
        className={`text-sm font-extrabold ${warm ? "text-[var(--landing-green)]" : "text-[var(--landing-forest)]"}`}
      >
        {value}
      </div>
    </div>
  );
}

function FallbackRow({ color }: { color: string }) {
  return (
    <div className="mb-1 flex items-center gap-1.5 rounded bg-white px-1.5 py-1 shadow-sm">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      <span className="h-1.5 flex-1 rounded bg-[#e8efe8]" />
    </div>
  );
}

function PhoneFallback() {
  return (
    <div className="flex h-full w-full flex-col">
      <div className="bg-gradient-to-br from-[var(--landing-green)] to-[var(--landing-forest)] px-2 pt-4 pb-2">
        <div className="h-2 w-2/3 rounded bg-white/90" />
        <div className="mt-1 h-1.5 w-1/2 rounded bg-white/50" />
      </div>
      <div className="flex-1 space-y-1.5 p-1.5">
        <div className="rounded-md bg-white p-1.5 shadow-sm">
          <div className="h-1.5 w-3/4 rounded bg-[var(--landing-ink)]/70" />
          <div className="mt-1 h-1.5 w-1/2 rounded bg-[#cbd5cb]" />
        </div>
        <div className="rounded-md bg-white p-1.5 shadow-sm">
          <div className="h-1.5 w-3/4 rounded bg-[var(--landing-ink)]/70" />
          <div className="mt-1 h-1.5 w-1/2 rounded bg-[#cbd5cb]" />
        </div>
      </div>
    </div>
  );
}
