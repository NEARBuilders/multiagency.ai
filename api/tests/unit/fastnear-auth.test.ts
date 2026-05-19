import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { fastnearAuthHeaders } from "../../src/services/sputnik";

const ORIGINAL_KEY = process.env.FASTNEAR_API_KEY;

describe("fastnearAuthHeaders — Bearer leak guard", () => {
  beforeEach(() => {
    process.env.FASTNEAR_API_KEY = "test-key-xyz";
  });
  afterEach(() => {
    if (ORIGINAL_KEY === undefined) delete process.env.FASTNEAR_API_KEY;
    else process.env.FASTNEAR_API_KEY = ORIGINAL_KEY;
  });

  test("attaches Bearer on fastnear hosts", () => {
    expect(fastnearAuthHeaders("https://free.rpc.fastnear.com")).toEqual({
      Authorization: "Bearer test-key-xyz",
    });
    expect(fastnearAuthHeaders("https://test.rpc.fastnear.com/x")).toEqual({
      Authorization: "Bearer test-key-xyz",
    });
    expect(fastnearAuthHeaders("https://api.fastnear.com/v1/account/x/ft")).toEqual({
      Authorization: "Bearer test-key-xyz",
    });
  });

  test("does NOT attach Bearer on private/non-allowlist hosts", () => {
    expect(fastnearAuthHeaders("https://rpc.mainnet.near.org")).toEqual({});
    expect(fastnearAuthHeaders("https://my-private-rpc.example.com")).toEqual({});
    expect(fastnearAuthHeaders("https://near.org")).toEqual({});
  });

  test("returns empty when API key unset, even on allowlist host", () => {
    delete process.env.FASTNEAR_API_KEY;
    expect(fastnearAuthHeaders("https://free.rpc.fastnear.com")).toEqual({});
  });

  test("returns empty on unparseable URL", () => {
    expect(fastnearAuthHeaders("not-a-url")).toEqual({});
    expect(fastnearAuthHeaders("")).toEqual({});
  });
});
