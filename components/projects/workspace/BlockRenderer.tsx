import { createServerSupabaseClient } from "@/lib/database/server";
import { resolveProjectView } from "@/lib/projects/project-view-query";
import { TextBlock } from "./blocks/TextBlock";
import { HeadingBlock } from "./blocks/HeadingBlock";
import { CalloutBlock } from "./blocks/CalloutBlock";
import { ChecklistBlock } from "./blocks/ChecklistBlock";
import { DividerBlock } from "./blocks/DividerBlock";
import { LinkBlock } from "./blocks/LinkBlock";
import { TableBlock } from "./blocks/TableBlock";
import { ProjectViewBlock } from "./blocks/ProjectViewBlock";
import { BlockActions } from "./BlockActions";

export interface BlockRow {
  id: string;
  block_type: string;
  content: Record<string, unknown>;
}

export async function BlockRenderer({
  block,
  projectId,
  canEdit,
}: {
  block: BlockRow;
  projectId: string;
  canEdit: boolean;
}) {
  let body: React.ReactNode;

  switch (block.block_type) {
    case "text":
      body = <TextBlock blockId={block.id} projectId={projectId} content={block.content as never} canEdit={canEdit} />;
      break;
    case "heading":
      body = <HeadingBlock blockId={block.id} projectId={projectId} content={block.content as never} canEdit={canEdit} />;
      break;
    case "callout":
      body = <CalloutBlock blockId={block.id} projectId={projectId} content={block.content as never} canEdit={canEdit} />;
      break;
    case "checklist":
      body = <ChecklistBlock blockId={block.id} projectId={projectId} content={block.content as never} canEdit={canEdit} />;
      break;
    case "divider":
      body = <DividerBlock />;
      break;
    case "link":
      body = <LinkBlock blockId={block.id} projectId={projectId} content={block.content as never} canEdit={canEdit} />;
      break;
    case "table":
      body = <TableBlock blockId={block.id} projectId={projectId} content={block.content as never} canEdit={canEdit} />;
      break;
    case "project_view": {
      const supabase = await createServerSupabaseClient();
      const config = block.content as never;
      const result = await resolveProjectView(supabase, projectId, config);
      body = <ProjectViewBlock config={config} result={result} />;
      break;
    }
    default:
      body = null;
  }

  return (
    <div className="group flex items-start gap-2 rounded-md px-1 py-1 hover:bg-[var(--surface)]">
      <div className="flex-1">{body}</div>
      {canEdit && <BlockActions blockId={block.id} projectId={projectId} />}
    </div>
  );
}
