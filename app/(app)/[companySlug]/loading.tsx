import { SkeletonBlock, SkeletonCard } from "@/components/ui/Skeleton";

export default function TodayLoading() {
  return (
    <div className="flex flex-1 flex-col gap-4 px-8 py-6">
      <section className="rounded-[var(--radius-l)] border border-[var(--border-subtle)] bg-[var(--surface-1)] px-8 py-7">
        <SkeletonBlock className="h-3 w-40" />
        <SkeletonBlock className="mt-3 h-7 w-72" />
        <SkeletonBlock className="mt-2 h-3 w-48" />
      </section>

      <section className="grid grid-cols-1 gap-3.5 lg:grid-cols-4">
        <SkeletonCard lines={2} />
        <SkeletonCard lines={4} />
        <SkeletonCard lines={4} />
        <SkeletonCard lines={4} />
      </section>

      <section className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="ox-card flex flex-col gap-2 px-4 py-3.5">
            <SkeletonBlock className="h-6 w-6 rounded-[var(--radius-s)]" />
            <SkeletonBlock className="h-3 w-20" />
            <SkeletonBlock className="h-5 w-12" />
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-3.5 xl:grid-cols-3">
        <SkeletonCard lines={3} />
        <SkeletonCard lines={5} />
        <SkeletonCard lines={3} />
      </section>
    </div>
  );
}
