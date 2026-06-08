import { CheckInConfirm } from "./_components/checkin-confirm";

// Auth + tenant are handled by middleware and the (dashboard) layout, which
// also wraps this page in the normal app chrome (sidebar / bottom nav). The
// middleware preserves the `?t=` token through the login bounce for scans
// made while logged out.
export default async function CheckInPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { sessionId } = await params;
  const { t } = await searchParams;
  return <CheckInConfirm sessionId={sessionId} token={t ?? ""} />;
}
