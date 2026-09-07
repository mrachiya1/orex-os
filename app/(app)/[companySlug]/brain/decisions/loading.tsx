import { SkeletonPageHeader, SkeletonTable } from "@/components/ui/Skeleton";

export default function DecisionsLoading() {
  return (
    <div className="flex flex-1 flex-col">
      <SkeletonPageHeader />
      <div className="px-8 py-6">
        <SkeletonTable rows={6} />
      </div>
    </div>
  );
}
