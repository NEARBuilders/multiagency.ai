import { describe, expect, test } from "vitest";
import type { DaoProposalStatus, DaoRole } from "../../src/services/sputnik";
import { summarizeProposals, summarizeTeam, summarizeTreasury } from "../../src/services/summaries";

describe("summarizeProposals — proposals.getPublicSummary shape", () => {
  test("zero proposals → zero counts", () => {
    expect(summarizeProposals([], 0)).toEqual({ openCount: 0, totalCount: 0 });
  });

  test("totalCount tracks lastProposalId, openCount counts InProgress in window", () => {
    const recent: { status: DaoProposalStatus }[] = [
      { status: "InProgress" },
      { status: "Approved" },
      { status: "InProgress" },
      { status: "Rejected" },
    ];
    expect(summarizeProposals(recent, 42)).toEqual({ openCount: 2, totalCount: 42 });
  });

  test("non-InProgress statuses don't count toward openCount", () => {
    const recent: { status: DaoProposalStatus }[] = [
      { status: "Approved" },
      { status: "Rejected" },
      { status: "Removed" },
      { status: "Expired" },
      { status: "Moved" },
      { status: "Failed" },
    ];
    expect(summarizeProposals(recent, 6)).toEqual({ openCount: 0, totalCount: 6 });
  });
});

describe("summarizeTreasury — treasury.getPublicSummary shape", () => {
  test("empty inputs → zero state", () => {
    expect(summarizeTreasury({}, [])).toEqual({ nearBalance: "0", ftTokens: 0 });
  });

  test("nearBalance comes from balances.near (string passthrough)", () => {
    expect(summarizeTreasury({ near: "1000000000000000000000000" }, ["near"])).toEqual({
      nearBalance: "1000000000000000000000000",
      ftTokens: 0,
    });
  });

  test("ftTokens counts non-near tokenIds", () => {
    expect(
      summarizeTreasury({ near: "100" }, ["near", "usdc.tkn.primitives.near", "wnear.near"]),
    ).toEqual({ nearBalance: "100", ftTokens: 2 });
  });

  test("missing near balance defaults to '0'", () => {
    expect(
      summarizeTreasury({ "usdc.tkn.primitives.near": "5" }, ["usdc.tkn.primitives.near"]),
    ).toEqual({
      nearBalance: "0",
      ftTokens: 1,
    });
  });
});

describe("summarizeTeam — team.getPublicSummary shape", () => {
  const mkRole = (overrides: Partial<DaoRole>): DaoRole => ({
    name: "Role",
    isEveryone: false,
    members: [],
    permissions: [],
    ...overrides,
  });

  test("empty roles → zero counts", () => {
    expect(summarizeTeam([])).toEqual({ roleCount: 0, memberCount: 0 });
  });

  test("roleCount includes Everyone, memberCount excludes Everyone members", () => {
    const roles: DaoRole[] = [
      mkRole({ name: "Everyone", isEveryone: true, members: [] }),
      mkRole({ name: "Admin", members: ["alice.near"] }),
      mkRole({ name: "Approver", members: ["bob.near"] }),
    ];
    expect(summarizeTeam(roles)).toEqual({ roleCount: 3, memberCount: 2 });
  });

  test("members appearing in multiple roles are counted once", () => {
    const roles: DaoRole[] = [
      mkRole({ name: "Admin", members: ["alice.near", "bob.near"] }),
      mkRole({ name: "Approver", members: ["bob.near", "charlie.near"] }),
    ];
    expect(summarizeTeam(roles)).toEqual({ roleCount: 2, memberCount: 3 });
  });

  test("Everyone role's members are excluded even if non-empty (defensive)", () => {
    const roles: DaoRole[] = [
      mkRole({ name: "Everyone", isEveryone: true, members: ["should-not-count.near"] }),
      mkRole({ name: "Admin", members: ["alice.near"] }),
    ];
    expect(summarizeTeam(roles)).toEqual({ roleCount: 2, memberCount: 1 });
  });
});
