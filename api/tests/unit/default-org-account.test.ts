import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  defaultOrgAccount,
  HARDCODED_MAINNET,
  HARDCODED_TESTNET,
  pinnedNetwork,
} from "../../src/lib/default-org-account";

const ENV_KEYS = [
  "NEAR_NETWORK",
  "AGENCY_ORG_ACCOUNT_MAINNET",
  "AGENCY_ORG_ACCOUNT_TESTNET",
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

describe("defaultOrgAccount(network) — per-network resolution", () => {
  test("mainnet branch falls through to hardcoded default when env unset", () => {
    expect(defaultOrgAccount("mainnet")).toBe(HARDCODED_MAINNET);
  });

  test("testnet branch falls through to hardcoded default when env unset", () => {
    expect(defaultOrgAccount("testnet")).toBe(HARDCODED_TESTNET);
  });

  test("AGENCY_ORG_ACCOUNT_MAINNET overrides the mainnet branch", () => {
    process.env.AGENCY_ORG_ACCOUNT_MAINNET = "fork.sputnik-dao.near";
    expect(defaultOrgAccount("mainnet")).toBe("fork.sputnik-dao.near");
  });

  test("AGENCY_ORG_ACCOUNT_TESTNET overrides the testnet branch", () => {
    process.env.AGENCY_ORG_ACCOUNT_TESTNET = "fork.sputnikv2.testnet";
    expect(defaultOrgAccount("testnet")).toBe("fork.sputnikv2.testnet");
  });

  test("per-network override only applies to its own branch", () => {
    // Setting the testnet override has no effect on the mainnet branch.
    process.env.AGENCY_ORG_ACCOUNT_TESTNET = "fork.sputnikv2.testnet";
    expect(defaultOrgAccount("mainnet")).toBe(HARDCODED_MAINNET);
  });

  test("blank env (FOO=) falls through to the hardcoded default", () => {
    // `.env` files commonly carry `FOO=` blank; the resolver uses `||` so both
    // undefined and empty string fall through to the hardcoded value.
    process.env.AGENCY_ORG_ACCOUNT_MAINNET = "";
    expect(defaultOrgAccount("mainnet")).toBe(HARDCODED_MAINNET);
    process.env.AGENCY_ORG_ACCOUNT_TESTNET = "";
    expect(defaultOrgAccount("testnet")).toBe(HARDCODED_TESTNET);
  });

  test("re-reads process.env per call (no module-level memoization)", () => {
    expect(defaultOrgAccount("mainnet")).toBe(HARDCODED_MAINNET);
    process.env.AGENCY_ORG_ACCOUNT_MAINNET = "first.near";
    expect(defaultOrgAccount("mainnet")).toBe("first.near");
    process.env.AGENCY_ORG_ACCOUNT_MAINNET = "second.near";
    expect(defaultOrgAccount("mainnet")).toBe("second.near");
  });
});

describe("pinnedNetwork — NEAR_NETWORK env pin", () => {
  test("unset → null (no pin; caller derives network from session/cookie)", () => {
    expect(pinnedNetwork()).toBeNull();
  });

  test('"testnet" pins testnet', () => {
    process.env.NEAR_NETWORK = "testnet";
    expect(pinnedNetwork()).toBe("testnet");
  });

  test('"mainnet" pins mainnet', () => {
    process.env.NEAR_NETWORK = "mainnet";
    expect(pinnedNetwork()).toBe("mainnet");
  });

  test("uppercase TESTNET/MAINNET pins via toLowerCase() normalization", () => {
    process.env.NEAR_NETWORK = "TESTNET";
    expect(pinnedNetwork()).toBe("testnet");
    process.env.NEAR_NETWORK = "MAINNET";
    expect(pinnedNetwork()).toBe("mainnet");
  });

  test("unrecognized values return null (no pin)", () => {
    process.env.NEAR_NETWORK = "betanet";
    expect(pinnedNetwork()).toBeNull();
    process.env.NEAR_NETWORK = "";
    expect(pinnedNetwork()).toBeNull();
  });
});

describe("hardcoded constants — repo-canonical accounts", () => {
  test("HARDCODED_MAINNET and HARDCODED_TESTNET match repo-canonical values", () => {
    expect(HARDCODED_MAINNET).toBe("multiagency.sputnik-dao.near");
    expect(HARDCODED_TESTNET).toBe("multiagency.sputnikv2.testnet");
  });
});
