import { describe, expect, test } from "vitest";
import { getTokenMetadata, getTokenMetadataBySymbol } from "../../src/services/tokens";

describe("getTokenMetadataBySymbol — canonical mainnet resolution", () => {
  test("wNEAR resolves to wrap.near, not wrap.testnet", () => {
    expect(getTokenMetadataBySymbol("wNEAR")?.tokenId).toBe("wrap.near");
  });

  test("ETH resolves to eth.bridge.near (Rainbow Bridge), not aurora", () => {
    expect(getTokenMetadataBySymbol("ETH")?.tokenId).toBe("eth.bridge.near");
  });
});

describe("getTokenMetadata — by-id lookup is network-agnostic", () => {
  test("testnet entries remain findable by tokenId", () => {
    expect(getTokenMetadata("wrap.testnet")?.chainNetwork).toBe("testnet");
  });
});
