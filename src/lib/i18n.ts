import { getRequestConfig } from "next-intl/server";

export const locales = ["pt-PT"] as const;
export const defaultLocale = "pt-PT";

export default getRequestConfig(async () => {
  const locale = defaultLocale;

  return {
    locale,
    timeZone: "Europe/Lisbon",
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
