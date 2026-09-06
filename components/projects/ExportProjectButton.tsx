import { buttonClass } from "@/components/ui/Button";
import { IconDownload } from "@/components/ui/icons";

/**
 * Plain same-origin authenticated GET -- no client JS needed for the
 * download itself; the browser handles Content-Disposition: attachment
 * from app/api/projects/[projectId]/export/route.ts.
 */
export function ExportProjectButton({ projectId }: { projectId: string }) {
  return (
    <a href={`/api/projects/${projectId}/export`} className={`${buttonClass("secondary", "sm")} no-underline`}>
      <IconDownload width={13} height={13} />
      Export
    </a>
  );
}
