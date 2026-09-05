import Link from "next/link";
import { StatusBadge, HealthBadge } from "./ProjectStatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconProjects } from "@/components/ui/icons";
import type { ProjectStatus, ProjectHealthState, ProjectPriority } from "@/lib/projects/types";

export interface ProjectRow {
  id: string;
  name: string;
  project_code: string;
  status: ProjectStatus;
  health_state: ProjectHealthState;
  priority: ProjectPriority;
  target_date: string | null;
  owner_id: string | null;
}

export function ProjectTable({ rows, companySlug }: { rows: ProjectRow[]; companySlug: string }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<IconProjects width={16} height={16} />}
        title="No projects yet."
        body="Create the first project to start tracking delivery for this company."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="ox-table">
        <thead>
          <tr>
            <th>Project</th>
            <th>Status</th>
            <th>Health</th>
            <th>Priority</th>
            <th>Target date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <Link href={`/${companySlug}/projects/${row.id}`} className="ox-focus-ring font-semibold hover:underline">
                  {row.name}
                </Link>
                <span className="ml-2 num text-[10.5px] text-[var(--text-muted)]">{row.project_code}</span>
              </td>
              <td>
                <StatusBadge status={row.status} />
              </td>
              <td>
                <HealthBadge health={row.health_state} />
              </td>
              <td className="text-[var(--text-secondary)] capitalize">{row.priority}</td>
              <td className="num text-[var(--text-secondary)]">{row.target_date ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
