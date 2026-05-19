import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { proposals as proposalsTable } from "../../src/db/schema";
import {
  getLastProposalId,
  getProposal,
  isSputnikDao,
  userInRole,
} from "../../src/services/sputnik";
import { applyAllMigrations } from "./_pg";

function encodeViewResult(value: unknown): { result: number[] } {
  return { result: Array.from(new TextEncoder().encode(JSON.stringify(value))) };
}

function fakeRpcResponse(value: unknown): Response {
  return new Response(
    JSON.stringify({ jsonrpc: "2.0", id: "x", result: encodeViewResult(value) }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

// call_function errors surface inside result.error, not at the JSON-RPC top level.
function fakeRpcInnerError(message: string): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: "x", result: { error: message } }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

let testDaoCounter = 0;
function uniqueDao(): string {
  testDaoCounter += 1;
  return `dao-test-${testDaoCounter}.near`;
}

describe("sputnik service — proposal persistence", () => {
  let pg: PGlite;
  let db: ReturnType<typeof drizzle>;
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    const { PGlite } = await import("@electric-sql/pglite");
    pg = new PGlite("memory://");
    await applyAllMigrations(pg);
    db = drizzle(pg);
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    await pg.close();
  });

  test("getProposal returns persisted DB row without hitting RPC", async () => {
    const dao = uniqueDao();
    await db.insert(proposalsTable).values({
      daoAccountId: dao,
      proposalId: 42,
      proposer: "alice.near",
      description: "test transfer",
      status: "Approved",
      kindType: "Transfer",
      transferTokenId: "",
      transferReceiverId: "bob.near",
      transferAmount: "1000",
      submissionTime: "1700000000000000000",
    });

    const fetchSpy = vi.fn(() => Promise.reject(new Error("RPC should not be called")));
    globalThis.fetch = fetchSpy as never;

    const result = await getProposal(db as never, dao, 42);

    expect(result).toMatchObject({
      id: 42,
      proposer: "alice.near",
      status: "Approved",
      kind: { type: "Transfer", tokenId: "", receiverId: "bob.near", amount: "1000" },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("getProposal writes through to DB when RPC returns a terminal-status proposal", async () => {
    const dao = uniqueDao();
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(
        fakeRpcResponse({
          id: 7,
          proposer: "charlie.near",
          description: "rejected ask",
          kind: { Transfer: { token_id: "", receiver_id: "dave.near", amount: "500" } },
          status: "Rejected",
          submission_time: "1700000000000000000",
        }),
      ),
    ) as never;

    const result = await getProposal(db as never, dao, 7);
    expect(result?.status).toBe("Rejected");

    const rows = await db.select().from(proposalsTable).where(eq(proposalsTable.daoAccountId, dao));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ proposalId: 7, status: "Rejected" });
  });

  test("getLastProposalId surfaces inner result.error (e.g. ProhibitedInView)", async () => {
    const dao = uniqueDao();
    globalThis.fetch = vi.fn(() => Promise.resolve(fakeRpcInnerError("ProhibitedInView"))) as never;
    await expect(getLastProposalId(dao)).rejects.toThrow(/ProhibitedInView/);
  });

  test("getProposal swallows inner result.error and returns null (does not throw EOF)", async () => {
    const dao = uniqueDao();
    globalThis.fetch = vi.fn(() => Promise.resolve(fakeRpcInnerError("ProhibitedInView"))) as never;
    const result = await getProposal(db as never, dao, 99);
    expect(result).toBeNull();
  });

  test("getProposal does NOT write through when RPC returns InProgress", async () => {
    const dao = uniqueDao();
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(
        fakeRpcResponse({
          id: 3,
          proposer: "eve.near",
          description: "open ask",
          kind: { Transfer: { token_id: "", receiver_id: "frank.near", amount: "100" } },
          status: "InProgress",
          submission_time: "1700000000000000000",
        }),
      ),
    ) as never;

    const result = await getProposal(db as never, dao, 3);
    expect(result?.status).toBe("InProgress");

    const rows = await db.select().from(proposalsTable).where(eq(proposalsTable.daoAccountId, dao));
    expect(rows).toHaveLength(0);
  });
});

describe("userInRole — non-DAO org self-ownership", () => {
  test("non-DAO orgAccountId: returns true only when accountId matches the org", async () => {
    expect(await userInRole("alice.near", "alice.near", "Admin")).toBe(true);
    expect(await userInRole("alice.near", "bob.near", "Admin")).toBe(false);
  });

  test("non-DAO branch ignores role name (all gates collapse to self-ownership)", async () => {
    expect(await userInRole("alice.near", "alice.near", "Approver")).toBe(true);
    expect(await userInRole("alice.near", "alice.near", "Requestor")).toBe(true);
    expect(await userInRole("alice.near", "alice.near", "ArbitraryRoleName")).toBe(true);
  });

  test("isSputnikDao gates the branch correctly", () => {
    expect(isSputnikDao("alice.near")).toBe(false);
    expect(isSputnikDao("alice.testnet")).toBe(false);
    expect(isSputnikDao("foo.sputnik-dao.near")).toBe(true);
    expect(isSputnikDao("foo.sputnikv2.testnet")).toBe(true);
  });
});
