import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { getNetwork, NETWORK_HEADER } from "../../src/lib/network";

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

const headersWith = (network: string | null): Headers => {
  const h = new Headers();
  if (network !== null) h.set(NETWORK_HEADER, network);
  return h;
};

describe("getNetwork — precedence: pinned > header > mainnet default", () => {
  test("no pin, no header → mainnet default", () => {
    expect(getNetwork(new Headers())).toBe("mainnet");
  });

  test("no pin, no headers at all → mainnet default", () => {
    expect(getNetwork(undefined)).toBe("mainnet");
  });

  test("X-Network: testnet → testnet (free mode)", () => {
    expect(getNetwork(headersWith("testnet"))).toBe("testnet");
  });

  test("X-Network: mainnet → mainnet (free mode)", () => {
    expect(getNetwork(headersWith("mainnet"))).toBe("mainnet");
  });

  test("unrecognized header value falls through to mainnet", () => {
    expect(getNetwork(headersWith("betanet"))).toBe("mainnet");
  });

  test("`NEAR_NETWORK=testnet` pins testnet regardless of header", () => {
    process.env.NEAR_NETWORK = "testnet";
    expect(getNetwork(headersWith("mainnet"))).toBe("testnet");
    expect(getNetwork(headersWith(null))).toBe("testnet");
  });

  test("`NEAR_NETWORK=mainnet` pins mainnet regardless of header", () => {
    process.env.NEAR_NETWORK = "mainnet";
    expect(getNetwork(headersWith("testnet"))).toBe("mainnet");
  });

  test("unrecognized `NEAR_NETWORK` value does not pin — header still applies", () => {
    process.env.NEAR_NETWORK = "betanet";
    expect(getNetwork(headersWith("testnet"))).toBe("testnet");
    expect(getNetwork(headersWith(null))).toBe("mainnet");
  });

  test("NETWORK_HEADER constant matches the documented name", () => {
    expect(NETWORK_HEADER).toBe("x-network");
  });

  test("case-insensitive header match (Headers normalizes)", () => {
    const h = new Headers();
    h.set("X-Network", "testnet");
    expect(getNetwork(h)).toBe("testnet");
  });
});
