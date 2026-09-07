import { SkeletonBlock, SkeletonPageHeader, SkeletonTable } from "@/components/ui/Skeleton";

export default function ProjectsLoading() {
  return (
    <div className="flex flex-1 flex-col">
      <SkeletonPageHeader />
      <div className="flex flex-col gap-3.5 px-8 py-6">
        <div className="flex gap-2">
          <SkeletonBlock className="h-7 w-24" />
          <SkeletonBlock className="h-7 w-24" />
          <SkeletonBlock className="h-7 w-24" />
        </div>
        <SkeletonTable rows={8} />
      </div>
    </div>
  );
}
