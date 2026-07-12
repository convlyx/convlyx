import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans, Newsreader } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { TRPCProvider } from "@/lib/trpc-provider";
import { ChunkErrorReloader } from "@/components/chunk-error-reloader";
import { Toaster } from "@/components/ui/sonner";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { BRAND_THEME_COLOR_HEX } from "@/lib/constants/brand";
import "./globals.css";

// Pin SSR rendering to Dublin (eu-west-1) to co-locate with Supabase — avoids
// transatlantic DB latency. Applies to all routes under the root layout.
export const preferredRegion = "dub1";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Landing page (convlyx.com) typography — scoped to `.landing-scope`, the app
// itself keeps Inter. Plus Jakarta Sans for headings/UI, Newsreader italic for
// editorial accent words.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["italic"],
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "Convlyx",
    template: "%s | Convlyx",
  },
  description: "Gestão de escolas de condução",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Convlyx",
  },
};

export const viewport: Viewport = {
  themeColor: BRAND_THEME_COLOR_HEX,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${jakarta.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ChunkErrorReloader />
        <NextIntlClientProvider messages={messages}>
          <TRPCProvider>{children}</TRPCProvider>
          <Toaster position="bottom-right" richColors />
        </NextIntlClientProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
