/**
 * The fixed registry of SYSTEM properties (section 13: "connected to real
 * Orex project data... can be shown/hidden/reordered but their semantics
 * cannot be destroyed"). Unlike custom properties, these are never rows in
 * project_property_definitions -- they are the real `projects` columns
 * (plus two computed values, Next Task and Client Count, resolved at query
 * time like a Phase 004.5 project_view block, never stored). A project
 * view's `visibleColumns`/`order` arrays reference these by `key`,
 * interleaved with custom property definition ids.
 *
 * Two properties from the founder's full wishlist (Project Value,
 * Last Review/Reviewed By) are intentionally NOT in this registry yet --
 * they need new `projects` columns that were not part of this pass's
 * approved schema change (see prompts/007 "Remaining Gaps").
 */
export interface SystemPropertyDef {
  key: string;
  label: string;
  defaultVisible: boolean;
}

export const SYSTEM_PROPERTIES: SystemPropertyDef[] = [
  { key: "project", label: "Project", defaultVisible: true },
  { key: "category", label: "Category", defaultVisible: true },
  { key: "assigned", label: "Assigned", defaultVisible: true },
  { key: "status", label: "Status", defaultVisible: true },
  { key: "deadline", label: "Deadline", defaultVisible: true },
  { key: "updated", label: "Updated", defaultVisible: true },
  { key: "next_task", label: "Next Task", defaultVisible: true },
  { key: "priority", label: "Priority", defaultVisible: true },
  { key: "health", label: "Health", defaultVisible: false },
  { key: "client", label: "Client", defaultVisible: false },
  { key: "start_date", label: "Start Date", defaultVisible: false },
  { key: "folder", label: "Folder", defaultVisible: false },
  { key: "client_requests", label: "Client Requests", defaultVisible: false },
];

export const DEFAULT_VISIBLE_COLUMNS = SYSTEM_PROPERTIES.filter((p) => p.defaultVisible).map((p) => p.key);
export const DEFAULT_COLUMN_ORDER = SYSTEM_PROPERTIES.map((p) => p.key);
