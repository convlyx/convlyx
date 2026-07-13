import { ImageResponse } from "next/og";
import { createElement as el } from "react";

// Served at the stable URL https://convlyx.com/og-image.png, which every
// marketing page (homepage + SEO landing pages + blog) references in its
// OpenGraph/Twitter tags. Generated with next/og so there's no static asset to
// maintain and the brand look stays in code. Static; the image never changes.
export const preferredRegion = "dub1";
export const dynamic = "force-static";

// Convlyx landing palette (see .landing-scope in globals.css).
const FOREST = "#15803d";
const FOREST_DEEP = "#166534";
const ACCENT = "#4ade80";
const ACCENT_SOFT = "#bbf7d0";

export function GET() {
  return new ImageResponse(
    el(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background: `linear-gradient(135deg, ${FOREST} 0%, ${FOREST_DEEP} 100%)`,
          fontFamily: "sans-serif",
          position: "relative",
        },
      },
      // Soft accent glow, top-right.
      el("div", {
        style: {
          position: "absolute",
          top: "-160px",
          right: "-120px",
          width: "520px",
          height: "520px",
          borderRadius: "9999px",
          background: "rgba(74,222,128,0.22)",
          display: "flex",
        },
      }),
      // Brand mark + wordmark.
      el(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "18px" } },
        el(
          "div",
          {
            style: {
              width: "60px",
              height: "60px",
              borderRadius: "16px",
              background: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: FOREST,
              fontSize: "36px",
              fontWeight: 800,
            },
          },
          "C",
        ),
        el(
          "span",
          { style: { color: "#ffffff", fontSize: "32px", fontWeight: 700 } },
          "Convlyx",
        ),
      ),
      // Headline + subhead.
      el(
        "div",
        { style: { display: "flex", flexDirection: "column" } },
        el(
          "div",
          {
            style: {
              display: "flex",
              maxWidth: "920px",
              color: "#ffffff",
              fontSize: "82px",
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
            },
          },
          "Software para escolas de condução",
        ),
        el(
          "div",
          {
            style: {
              display: "flex",
              marginTop: "28px",
              color: ACCENT_SOFT,
              fontSize: "34px",
              fontWeight: 500,
            },
          },
          "Aulas, alunos, instrutores e exames do IMT numa só plataforma.",
        ),
      ),
      // Accent bar + domain.
      el(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          },
        },
        el("div", {
          style: {
            display: "flex",
            width: "120px",
            height: "8px",
            borderRadius: "9999px",
            background: ACCENT,
          },
        }),
        el(
          "span",
          {
            style: {
              color: "rgba(255,255,255,0.85)",
              fontSize: "28px",
              fontWeight: 600,
            },
          },
          "convlyx.com",
        ),
      ),
    ),
    { width: 1200, height: 630 },
  );
}
