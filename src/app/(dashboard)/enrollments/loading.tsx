import { ListPageSkeleton } from "@/components/skeletons/list-page-skeleton";

export default function EnrollmentsLoading() {
  return <ListPageSkeleton filters={1} showCreate={false} />;
}
