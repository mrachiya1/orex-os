import type { ProjectViewResult } from "@/lib/projects/project-view-query";
import type { ProjectViewConfig } from "@/lib/projects/project-view-query";

const SOURCE_LABEL: Record<ProjectViewConfig["sourceType"], string> = {
  tasks: "Tasks",
  milestones: "Milestones",
  deliverables: "Deliverables",
  scope_changes: "Scope changes",
  readiness_checks: "Readiness checks",
};

export function ProjectViewBlock({ config, result }: { config: ProjectViewConfig; result: ProjectViewResult }) {
  if (config.displayMode === "count") {
    return (
      <p className="text-sm">
        <span className="font-semibold">{result.count}</span> {SOURCE_LABEL[config.sourceType].toLowerCase()}
      </p>
    );
  }

  if (result.rows.length === 0) {
    return <p className="text-sm text-[var(--muted)]">No {SOURCE_LABEL[config.sourceType].toLowerCase()} match this view.</p>;
  }

  return (
    <ul className="space-y-1 text-sm">
      {result.rows.map((row) => (
        <li key={row.id} className="flex items-center justify-between">
          <span>{row.label}</span>
          {row.meta && <span className="font-mono text-xs text-[var(--muted)]">{row.meta}</span>}
        </li>
      ))}
    </ul>
  );
}
