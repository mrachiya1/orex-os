import { describe, it, expect } from "vitest";
import { parseAuthErrorFragment } from "./auth-error-fragment";

describe("parseAuthErrorFragment", () => {
  it("returns null for an empty hash", () => {
    expect(parseAuthErrorFragment("")).toBeNull();
  });

  it("returns null for a hash with no error param", () => {
    expect(parseAuthErrorFragment("#foo=bar")).toBeNull();
  });

  it("maps otp_expired to the expired-link message", () => {
    const result = parseAuthErrorFragment(
      "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired"
    );
    expect(result).toEqual({
      code: "otp_expired",
      message: "That email link has expired or has already been used.",
    });
  });

  it("maps a bare access_denied (no error_code) to the same expired-link message", () => {
    const result = parseAuthErrorFragment("#error=access_denied&error_description=Denied");
    expect(result).toEqual({
      code: "access_denied",
      message: "That email link has expired or has already been used.",
    });
  });

  it("falls back to a generic message for an unrecognized error code", () => {
    const result = parseAuthErrorFragment("#error=server_error&error_code=unexpected_failure");
    expect(result?.code).toBe("unexpected_failure");
    expect(result?.message).toBe("That link could not be used to sign you in. Please request a new one.");
  });

  it("never echoes the raw error_description back", () => {
    const result = parseAuthErrorFragment(
      "#error=access_denied&error_code=otp_expired&error_description=Something+very+internal+and+specific"
    );
    expect(result?.message).not.toContain("internal");
  });

  it("accepts a hash without the leading #", () => {
    const result = parseAuthErrorFragment("error=access_denied&error_code=otp_expired");
    expect(result?.code).toBe("otp_expired");
  });
});
