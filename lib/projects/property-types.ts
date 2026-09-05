/**
 * Property type constants shared between client components (which only
 * need to know the type list/labels to render pickers) and the server-side
 * validation in lib/validation/project-properties.ts (which additionally
 * pulls in lib/projects/url-safety.ts, a "server-only" module). Kept
 * separate so importing this from a Client Component never drags
 * "server-only" into the browser bundle.
 */
export const PROPERTY_TYPES = [
  "text", "number", "select", "multi_select", "status",
  "date", "person", "files", "checkbox", "url", "email", "phone",
] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];
