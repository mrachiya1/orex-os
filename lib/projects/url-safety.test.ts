import { describe, it, expect } from "vitest";
import { assertSafeReferenceUrl } from "./url-safety";

describe("assertSafeReferenceUrl", () => {
  it("accepts a plain https URL", () => {
    expect(() => assertSafeReferenceUrl("https://drive.google.com/file/d/abc123")).not.toThrow();
  });

  it("rejects a malformed URL", () => {
    expect(() => assertSafeReferenceUrl("not a url")).toThrow();
  });

  it("rejects a non-http(s) protocol", () => {
    expect(() => assertSafeReferenceUrl("ftp://files.example.com/final.mov")).toThrow();
  });

  it("rejects embedded userinfo credentials", () => {
    expect(() => assertSafeReferenceUrl("https://user:hunter2@example.com/file")).toThrow();
  });

  it("rejects a secret-looking query parameter", () => {
    expect(() => assertSafeReferenceUrl("https://example.com/file?api_key=abc123")).toThrow();
    expect(() => assertSafeReferenceUrl("https://example.com/file?token=abc123")).toThrow();
  });

  it("accepts an ordinary query parameter", () => {
    expect(() => assertSafeReferenceUrl("https://example.com/file?version=3")).not.toThrow();
  });
});
