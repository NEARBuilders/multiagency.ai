import { describe, expect, it } from "vitest";
import {
  displayToBaseUnits,
  getTokenMetadata,
  getTokenMetadataBySymbol,
  KNOWN_TOKENS,
} from "../../src/services/tokens";

describe("displayToBaseUnits", () => {
  it("converts integer display amount to base units", () => {
    expect(displayToBaseUnits("100", 24)).toBe(100n * 10n ** 24n);
    expect(displayToBaseUnits("1500", 6)).toBe(1500_000_000n);
    expect(displayToBaseUnits("1", 0)).toBe(1n);
  });

  it("handles fractional display amounts with decimal padding", () => {
    expect(displayToBaseUnits("1.5", 6)).toBe(1_500_000n);
    expect(displayToBaseUnits("0.1", 24)).toBe(10n ** 23n);
  });

  it("truncates fractional part exceeding token decimals", () => {
    expect(displayToBaseUnits("1.123456789", 6)).toBe(1_123_456n);
  });

  it("handles zero", () => {
    expect(displayToBaseUnits("0", 24)).toBe(0n);
  });
});

describe("getTokenMetadataBySymbol", () => {
  it("returns canonical token by symbol", () => {
    const near = getTokenMetadataBySymbol("NEAR");
    expect(near?.tokenId).toBe("near");
    expect(near?.decimals).toBe(24);
  });

  it("returns null for unknown symbol", () => {
    expect(getTokenMetadataBySymbol("DOGECOIN")).toBeNull();
  });

  it("agrees with getTokenMetadata for round-trip", () => {
    for (const t of KNOWN_TOKENS) {
      const bySymbol = getTokenMetadataBySymbol(t.symbol);
      const byId = getTokenMetadata(t.tokenId);
      expect(byId?.tokenId).toBe(t.tokenId);
      // Multiple tokens may share a symbol (e.g. ETH on bridge vs aurora); first match wins.
      expect(bySymbol?.symbol).toBe(t.symbol);
    }
  });
});
