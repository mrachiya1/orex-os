import { SkeletonCard, SkeletonPageHeader } from "@/components/ui/Skeleton";

export default function BrainLoading() {
  return (
    <div className="flex flex-1 flex-col">
      <SkeletonPageHeader />
      <div className="grid grid-cols-1 gap-3.5 px-8 py-6 sm:grid-cols-3">
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
      </div>
    </div>
  );
}
