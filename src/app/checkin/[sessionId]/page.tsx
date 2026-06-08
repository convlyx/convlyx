import { redirect } from "next/navigation";
import { getDashboardUser } from "@/server/dashboard-user";
import { CheckInConfirm } from "./_components/checkin-confirm";

export default async function CheckInPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { sessionId } = await params;
  const { t } = await searchParams;

  // Deep-link target: if not signed in, bounce to login and return here after.
  // The login form reads `redirectTo` and navigates to it on success.
  const user = await getDashboardUser();
  if (!user) {
    const target = `/checkin/${sessionId}${t ? `?t=${t}` : ""}`;
    redirect(`/login?redirectTo=${encodeURIComponent(target)}`);
  }

  return <CheckInConfirm sessionId={sessionId} token={t ?? ""} />;
}
