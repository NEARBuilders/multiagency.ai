import { describe, expect, test } from "vitest";
import { safeHttpHref } from "../src/lib/url";

describe("safeHttpHref", () => {
  test("passes through https URLs unchanged", () => {
    expect(safeHttpHref("https://drive.google.com/drive/folders/abc")).toBe(
      "https://drive.google.com/drive/folders/abc",
    );
    expect(safeHttpHref("https://example.com")).toBe("https://example.com");
  });

  test("passes through http URLs unchanged", () => {
    expect(safeHttpHref("http://example.com")).toBe("http://example.com");
  });

  test("prepends https:// to schemeless inputs (real NEARN submission shape)", () => {
    expect(safeHttpHref("drive.google.com/drive/folders/abc")).toBe(
      "https://drive.google.com/drive/folders/abc",
    );
    expect(safeHttpHref("x.com/i/status/123")).toBe("https://x.com/i/status/123");
  });

  test("rejects javascript: URLs (XSS gate)", () => {
    expect(safeHttpHref("javascript:alert(1)")).toBeNull();
    expect(safeHttpHref("JAVASCRIPT:alert(1)")).toBeNull();
    expect(safeHttpHref("  javascript:alert(1)  ")).toBeNull();
  });

  test("rejects data: URLs", () => {
    expect(safeHttpHref("data:text/html,<script>alert(1)</script>")).toBeNull();
  });

  test("rejects file: and ftp: schemes", () => {
    expect(safeHttpHref("file:///etc/passwd")).toBeNull();
    expect(safeHttpHref("ftp://example.com")).toBeNull();
  });

  test("returns null for null/undefined/empty", () => {
    expect(safeHttpHref(null)).toBeNull();
    expect(safeHttpHref(undefined)).toBeNull();
    expect(safeHttpHref("")).toBeNull();
    expect(safeHttpHref("   ")).toBeNull();
  });

  test("trims surrounding whitespace before validation", () => {
    expect(safeHttpHref("  https://example.com  ")).toBe("https://example.com");
    expect(safeHttpHref("\ndrive.google.com/abc\n")).toBe("https://drive.google.com/abc");
  });

  test("returns null for unparseable strings", () => {
    expect(safeHttpHref("not a url at all with spaces in between")).toBeNull();
  });
});
