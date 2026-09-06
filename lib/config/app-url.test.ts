import { describe, it, expect, afterEach, vi } from "vitest";
import { getAppUrl, isSafeInternalPath, buildAppUrl, buildAuthCallbackUrl } from "./app-url";

const ORIGINAL_APP_URL = process.env.APP_URL;
const ORIGINAL_VERCEL_ENV = process.env.VERCEL_ENV;

afterEach(() => {
  if (ORIGINAL_APP_URL === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = ORIGINAL_APP_URL;
  if (ORIGINAL_VERCEL_ENV === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = ORIGINAL_VERCEL_ENV;
  vi.restoreAllMocks();
});

describe("getAppUrl", () => {
  it("falls back to localhost when APP_URL is unset", () => {
    delete process.env.APP_URL;
    expect(getAppUrl()).toBe("http://localhost:3000");
  });

  it("uses APP_URL when set, trimming whitespace and trailing slashes", () => {
    process.env.APP_URL = " https://orex-os.vercel.app/ ";
    expect(getAppUrl()).toBe("https://orex-os.vercel.app");
  });
});

describe("isSafeInternalPath", () => {
  it("accepts an ordinary relative path", () => {
    expect(isSafeInternalPath("/accept-invite/abc123")).toBe(true);
  });

  it("accepts a relative path with a query string", () => {
    expect(isSafeInternalPath("/reset-password?foo=bar")).toBe(true);
  });

  it("rejects an absolute URL", () => {
    expect(isSafeInternalPath("https://evil.example.com")).toBe(false);
  });

  it("rejects a protocol-relative URL", () => {
    expect(isSafeInternalPath("//evil.example.com")).toBe(false);
  });

  it("rejects a backslash trick", () => {
    expect(isSafeInternalPath("/\\evil.example.com")).toBe(false);
  });

  it("rejects a path not starting with a slash", () => {
    expect(isSafeInternalPath("accept-invite/abc123")).toBe(false);
  });

  it("rejects embedded whitespace/control characters", () => {
    expect(isSafeInternalPath("/foo\nbar")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isSafeInternalPath("")).toBe(false);
  });
});

describe("buildAppUrl", () => {
  it("builds an absolute URL from APP_URL and a safe path", () => {
    process.env.APP_URL = "https://orex-os.vercel.app";
    expect(buildAppUrl("/accept-invite/tok")).toBe("https://orex-os.vercel.app/accept-invite/tok");
  });

  it("falls back to / for an unsafe path instead of allowing an open redirect", () => {
    process.env.APP_URL = "https://orex-os.vercel.app";
    expect(buildAppUrl("//evil.example.com")).toBe("https://orex-os.vercel.app/");
  });
});

describe("buildAuthCallbackUrl", () => {
  it("builds a production callback URL when APP_URL is the production domain", () => {
    process.env.APP_URL = "https://orex-os.vercel.app";
    const url = buildAuthCallbackUrl("/reset-password");
    expect(url).toBe("https://orex-os.vercel.app/auth/callback?next=%2Freset-password");
  });

  it("builds a localhost callback URL in local dev when APP_URL is unset", () => {
    delete process.env.APP_URL;
    const url = buildAuthCallbackUrl("/reset-password");
    expect(url).toBe("http://localhost:3000/auth/callback?next=%2Freset-password");
  });

  it("defaults next to / when omitted", () => {
    process.env.APP_URL = "https://orex-os.vercel.app";
    expect(buildAuthCallbackUrl()).toBe("https://orex-os.vercel.app/auth/callback?next=%2F");
  });

  it("rejects an open-redirect next path and falls back to /", () => {
    process.env.APP_URL = "https://orex-os.vercel.app";
    expect(buildAuthCallbackUrl("https://evil.example.com")).toBe(
      "https://orex-os.vercel.app/auth/callback?next=%2F"
    );
  });

  it("logs an error when running in a Vercel production runtime with a localhost APP_URL", () => {
    process.env.VERCEL_ENV = "production";
    delete process.env.APP_URL;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    buildAuthCallbackUrl("/reset-password");
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("localhost"));
  });

  it("does not log when APP_URL is a real domain in production", () => {
    process.env.VERCEL_ENV = "production";
    process.env.APP_URL = "https://orex-os.vercel.app";
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    buildAuthCallbackUrl("/reset-password");
    expect(spy).not.toHaveBeenCalled();
  });
});
