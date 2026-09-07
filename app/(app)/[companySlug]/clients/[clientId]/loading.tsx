import { SkeletonBlock, SkeletonCard } from "@/components/ui/Skeleton";

export default function ClientDetailLoading() {
  return (
    <div className="flex flex-col gap-4">
      <section className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="ox-card flex flex-col gap-2 px-4 py-3.5">
            <SkeletonBlock className="h-3 w-20" />
            <SkeletonBlock className="h-5 w-16" />
          </div>
        ))}
      </section>
      <section className="grid grid-cols-1 gap-3.5 xl:grid-cols-3">
        <div className="xl:col-span-2"><SkeletonCard lines={5} /></div>
        <SkeletonCard lines={5} />
      </section>
    </div>
  );
}
