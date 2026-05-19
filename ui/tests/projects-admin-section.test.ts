import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const source = readFileSync(
  resolve(import.meta.dirname, "..", "src", "components", "projects-admin-section.tsx"),
  "utf8",
);

describe("projects-admin-section — repository field plumbing", () => {
  test("create form holds repository state and submits it (empty → undefined)", () => {
    expect(source).toMatch(/const\s+\[repository,\s*setRepository\]\s*=\s*useState/);
    expect(source).toMatch(/repository:\s*repository\.trim\(\)\s*\|\|\s*undefined/);
  });

  test("repository is optional: canSubmit does NOT gate on repository being non-empty", () => {
    expect(source).not.toMatch(/repository\.trim\(\)\.length\s*>\s*0/);
    // canSubmit should only gate on slug + title + !isPending
    expect(source).toMatch(
      /canSubmit\s*=\s*slug\.trim\(\)\.length\s*>\s*0\s*&&\s*title\.trim\(\)\.length\s*>\s*0\s*&&\s*!isPending/,
    );
  });

  test("Project type carries repository field (consumed by edit form)", () => {
    expect(source).toMatch(/repository:\s*string\s*\|\s*null/);
  });

  test("edit form initializes repository from project.repository and writes via adminUpdate", () => {
    expect(source).toMatch(/setRepository\(project\.repository\s*\?\?\s*""\)/);
    expect(source).toMatch(/repository:\s*repository\.trim\(\)\s*\|\|\s*undefined/);
  });
});
