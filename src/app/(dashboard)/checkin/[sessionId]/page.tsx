import { redirect } from "next/navigation";

// Native-camera deep link. Auth + tenant are handled by middleware (which
// preserves the ?t= token through the login bounce). We redirect to the home
// painel with the token so the check-in is confirmed in the same dialog the
// in-app scanner uses — same popup, same app chrome — instead of a bare page.
export default async function CheckInPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { sessionId } = await params;
  const { t } = await searchParams;
  const query = new URLSearchParams({ checkin: sessionId, ...(t ? { t } : {}) });
  redirect(`/?${query.toString()}`);
}
