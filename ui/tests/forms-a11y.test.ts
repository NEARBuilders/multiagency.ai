import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const FORM_FILES = ["apply.tsx", "register.tsx", "contact.tsx"];

function read(file: string): string {
  return readFileSync(resolve(import.meta.dirname, "..", "src", "routes", "_layout", file), "utf8");
}

describe("intake form a11y surface", () => {
  for (const file of FORM_FILES) {
    const source = read(file);

    test(`${file} marks inputs aria-invalid when errors exist`, () => {
      expect(source).toMatch(/aria-invalid=\{[^}]*err[^}]*\}/);
    });

    test(`${file} links inputs to error message via aria-describedby`, () => {
      expect(source).toMatch(/aria-describedby=\{[^}]*err[^}]*\}/);
    });

    test(`${file} uses aria-live="polite" for error messages, not role="alert"`, () => {
      expect(source).toMatch(/aria-live="polite"/);
      expect(source).not.toMatch(/role="alert"/);
    });

    test(`${file} runs validateAllFields("submit") so empty-submit surfaces errors`, () => {
      expect(source).toMatch(/validateAllFields\("submit"\)/);
    });

    test(`${file} validators include onSubmit, not just onChange`, () => {
      expect(source).toMatch(/onChange:\s*\w+Schema,\s*onSubmit:\s*\w+Schema/);
    });
  }
});
