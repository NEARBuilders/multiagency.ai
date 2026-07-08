import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  defaultAdminRoleName,
  defaultApproverRoleName,
  defaultContactEmail,
  defaultDescription,
  defaultDocsUrl,
  defaultHeadline,
  defaultName,
  defaultNearnAccountId,
  defaultPublicSettings,
  defaultRequestorRoleName,
  defaultTagline,
  defaultWebsiteUrl,
  HARDCODED_CONTACT_EMAIL,
  HARDCODED_DESCRIPTION,
  HARDCODED_DOCS_URL,
  HARDCODED_HEADLINE,
  HARDCODED_NAME,
  HARDCODED_NEARN_ACCOUNT,
  HARDCODED_TAGLINE,
  HARDCODED_WEBSITE_URL,
} from "../../src/lib/settings-defaults";

const ENV_KEYS = [
  "AGENCY_NAME",
  "AGENCY_HEADLINE",
  "AGENCY_TAGLINE",
  "AGENCY_CONTACT_EMAIL",
  "AGENCY_WEBSITE_URL",
  "AGENCY_DOCS_URL",
  "AGENCY_DESCRIPTION",
  "AGENCY_NEARN_ACCOUNT",
  "AGENCY_ADMIN_ROLE",
  "AGENCY_APPROVER_ROLE",
  "AGENCY_REQUESTOR_ROLE",
  "AGENCY_DAO_ACCOUNT",
  "NEAR_NETWORK",
] as const;

const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  for (const k of ENV_KEYS) delete process.env[k];
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("settings-defaults — per-field resolution", () => {
  test("required-shape fields fall through to hardcoded defaults when env unset", () => {
    expect(defaultName()).toBe(HARDCODED_NAME);
    expect(defaultHeadline()).toBe(HARDCODED_HEADLINE);
    expect(defaultTagline()).toBe(HARDCODED_TAGLINE);
    expect(defaultContactEmail()).toBe(HARDCODED_CONTACT_EMAIL);
  });

  test("operational fields fall through to hardcoded fallbacks when env unset", () => {
    expect(defaultWebsiteUrl()).toBe(HARDCODED_WEBSITE_URL);
    expect(defaultDocsUrl()).toBe(HARDCODED_DOCS_URL);
    expect(defaultDescription()).toBe(HARDCODED_DESCRIPTION);
    expect(defaultNearnAccountId()).toBe(HARDCODED_NEARN_ACCOUNT);
  });

  test("env values win for operational fields", () => {
    process.env.AGENCY_WEBSITE_URL = "https://forkco.example";
    process.env.AGENCY_DOCS_URL = "https://docs.forkco.example";
    process.env.AGENCY_DESCRIPTION = "An agency operated by Forkco.";
    process.env.AGENCY_NEARN_ACCOUNT = "forkco-sponsor";
    expect(defaultWebsiteUrl()).toBe("https://forkco.example");
    expect(defaultDocsUrl()).toBe("https://docs.forkco.example");
    expect(defaultDescription()).toBe("An agency operated by Forkco.");
    expect(defaultNearnAccountId()).toBe("forkco-sponsor");
  });

  test("brand-identity fields (name/headline/tagline) are invariant — AGENCY_* env vars cannot override", () => {
    process.env.AGENCY_NAME = "Forkco";
    process.env.AGENCY_HEADLINE = "Build agencies, ship fast";
    process.env.AGENCY_TAGLINE = "by Forkco";
    expect(defaultName()).toBe(HARDCODED_NAME);
    expect(defaultHeadline()).toBe(HARDCODED_HEADLINE);
    expect(defaultTagline()).toBe(HARDCODED_TAGLINE);
  });

  test("contactEmail is operational — AGENCY_CONTACT_EMAIL env var overrides hardcoded fallback", () => {
    process.env.AGENCY_CONTACT_EMAIL = "ops@forkco.example";
    expect(defaultContactEmail()).toBe("ops@forkco.example");
  });

  test("contactEmail falls back to hardcoded when env unset", () => {
    expect(defaultContactEmail()).toBe(HARDCODED_CONTACT_EMAIL);
  });

  test("blank env (FOO=) falls through to hardcoded fallbacks", () => {
    process.env.AGENCY_WEBSITE_URL = "";
    process.env.AGENCY_DOCS_URL = "";
    process.env.AGENCY_DESCRIPTION = "";
    process.env.AGENCY_NEARN_ACCOUNT = "";
    expect(defaultWebsiteUrl()).toBe(HARDCODED_WEBSITE_URL);
    expect(defaultDocsUrl()).toBe(HARDCODED_DOCS_URL);
    expect(defaultDescription()).toBe(HARDCODED_DESCRIPTION);
    expect(defaultNearnAccountId()).toBe(HARDCODED_NEARN_ACCOUNT);
  });

  test("operational resolvers re-read process.env per call (no module-level memoization)", () => {
    expect(defaultNearnAccountId()).toBe(HARDCODED_NEARN_ACCOUNT);
    process.env.AGENCY_NEARN_ACCOUNT = "first";
    expect(defaultNearnAccountId()).toBe("first");
    process.env.AGENCY_NEARN_ACCOUNT = "second";
    expect(defaultNearnAccountId()).toBe("second");
  });
});

describe("defaultPublicSettings(network) — composite shape", () => {
  test("returns all fields with hardcoded defaults when env unset (mainnet)", () => {
    expect(defaultPublicSettings("mainnet")).toEqual({
      name: HARDCODED_NAME,
      headline: HARDCODED_HEADLINE,
      tagline: HARDCODED_TAGLINE,
      description: HARDCODED_DESCRIPTION,
      contactEmail: HARDCODED_CONTACT_EMAIL,
      nearnAccountId: HARDCODED_NEARN_ACCOUNT,
      websiteUrl: HARDCODED_WEBSITE_URL,
      docsUrl: HARDCODED_DOCS_URL,
      orgAccountId: "multiagency.sputnik-dao.near",
    });
  });

  test("testnet network selector resolves orgAccountId to the testnet hardcoded default", () => {
    expect(defaultPublicSettings("testnet").orgAccountId).toBe("multiagency.sputnikv2.testnet");
  });

  test("AGENCY_* overrides surface in the composite shape; brand fields stay invariant", () => {
    process.env.AGENCY_NAME = "Forkco";
    process.env.AGENCY_NEARN_ACCOUNT = "forkco";
    const s = defaultPublicSettings("mainnet");
    expect(s.name).toBe(HARDCODED_NAME);
    expect(s.nearnAccountId).toBe("forkco");
    expect(s.headline).toBe(HARDCODED_HEADLINE);
  });
});

describe("hardcoded constants — repo-canonical values", () => {
  test("brand identity matches maintainer identity", () => {
    expect(HARDCODED_NAME).toBe("MultiAgency");
    expect(HARDCODED_HEADLINE).toBe("Open Books · Open Source · Open Doors");
    expect(HARDCODED_TAGLINE).toBe("The future of work is near…");
    expect(HARDCODED_CONTACT_EMAIL).toBe("multiagentic@gmail.com");
  });

  test("operational identity matches deployment values", () => {
    expect(HARDCODED_WEBSITE_URL).toBe("https://multiagency.ai");
    expect(HARDCODED_DOCS_URL).toBe("https://multiagency.ai/docs");
    expect(HARDCODED_DESCRIPTION).toBe("Human-led, AI-native agencies for hire.");
    expect(HARDCODED_NEARN_ACCOUNT).toBe("multiagency");
  });
});

describe("role-name resolvers — gate inputs", () => {
  test("fall through to Sputnik/Trezu-standard names when env unset", () => {
    expect(defaultAdminRoleName()).toBe("Admin");
    expect(defaultApproverRoleName()).toBe("Approver");
    expect(defaultRequestorRoleName()).toBe("Requestor");
  });

  test("env values win over hardcoded defaults", () => {
    process.env.AGENCY_ADMIN_ROLE = "Council";
    process.env.AGENCY_APPROVER_ROLE = "Treasurer";
    process.env.AGENCY_REQUESTOR_ROLE = "Member";
    expect(defaultAdminRoleName()).toBe("Council");
    expect(defaultApproverRoleName()).toBe("Treasurer");
    expect(defaultRequestorRoleName()).toBe("Member");
  });

  test("blank env (FOO=) falls through to hardcoded defaults", () => {
    process.env.AGENCY_ADMIN_ROLE = "";
    process.env.AGENCY_APPROVER_ROLE = "";
    process.env.AGENCY_REQUESTOR_ROLE = "";
    expect(defaultAdminRoleName()).toBe("Admin");
    expect(defaultApproverRoleName()).toBe("Approver");
    expect(defaultRequestorRoleName()).toBe("Requestor");
  });

  test("resolvers re-read process.env per call (no module-level memoization)", () => {
    expect(defaultAdminRoleName()).toBe("Admin");
    process.env.AGENCY_ADMIN_ROLE = "First";
    expect(defaultAdminRoleName()).toBe("First");
    process.env.AGENCY_ADMIN_ROLE = "Second";
    expect(defaultAdminRoleName()).toBe("Second");
  });
});
