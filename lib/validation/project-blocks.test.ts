import { describe, it, expect } from "vitest";
import { validateBlockContent } from "./project-blocks";

describe("validateBlockContent", () => {
  it("accepts valid content for every block type", () => {
    expect(() => validateBlockContent("text", { text: "hello" })).not.toThrow();
    expect(() => validateBlockContent("heading", { text: "Title", level: 2 })).not.toThrow();
    expect(() => validateBlockContent("callout", { text: "Note", tone: "warning" })).not.toThrow();
    expect(() =>
      validateBlockContent("checklist", { items: [{ id: "1", text: "Do X", checked: false }] })
    ).not.toThrow();
    expect(() => validateBlockContent("divider", {})).not.toThrow();
    expect(() => validateBlockContent("link", { url: "https://example.com", label: "Example" })).not.toThrow();
    expect(() =>
      validateBlockContent("table", {
        columns: [{ id: "c1", name: "Name", type: "text" }],
        rows: [{ c1: "Alice" }],
      })
    ).not.toThrow();
    expect(() =>
      validateBlockContent("project_view", { sourceType: "tasks", displayMode: "list" })
    ).not.toThrow();
  });

  it("rejects an invalid heading level", () => {
    expect(() => validateBlockContent("heading", { text: "x", level: 4 })).toThrow();
  });

  it("rejects a malformed link URL", () => {
    expect(() => validateBlockContent("link", { url: "not-a-url", label: "x" })).toThrow();
  });

  it("rejects an unknown table column type", () => {
    expect(() =>
      validateBlockContent("table", {
        columns: [{ id: "c1", name: "Name", type: "formula" }],
        rows: [],
      })
    ).toThrow();
  });

  it("rejects a table with more than 20 columns", () => {
    const columns = Array.from({ length: 21 }, (_, i) => ({ id: `c${i}`, name: `Col ${i}`, type: "text" as const }));
    expect(() => validateBlockContent("table", { columns, rows: [] })).toThrow();
  });

  it("rejects a project_view sort field not on the whitelist for its source type", () => {
    expect(() =>
      validateBlockContent("project_view", {
        sourceType: "tasks",
        displayMode: "list",
        sort: { field: "secret_internal_column", direction: "asc" },
      })
    ).toThrow();
  });

  it("accepts a project_view sort field that is on the whitelist for its source type", () => {
    expect(() =>
      validateBlockContent("project_view", {
        sourceType: "tasks",
        displayMode: "list",
        sort: { field: "due_date", direction: "asc" },
      })
    ).not.toThrow();
  });

  it("rejects an unrecognized checklist item shape", () => {
    expect(() => validateBlockContent("checklist", { items: [{ text: "missing id/checked" }] })).toThrow();
  });
});
