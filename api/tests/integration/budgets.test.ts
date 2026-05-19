import type { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  BudgetInsufficientError,
  createBudget,
  deallocateBudget,
  listBudgets,
  transferBudget,
} from "../../src/services/budgets";
import { applyAllMigrations } from "./_pg";

const PROJECT_A = "00000000-0000-0000-0000-00000000000a";
const PROJECT_B = "00000000-0000-0000-0000-00000000000b";
const PROJECT_C = "00000000-0000-0000-0000-00000000000c";

describe("budgets service — persistence and corrections", () => {
  let pg: PGlite;
  let db: ReturnType<typeof drizzle>;

  beforeEach(async () => {
    const { PGlite } = await import("@electric-sql/pglite");
    pg = new PGlite("memory://");
    await applyAllMigrations(pg);
    db = drizzle(pg);
  });

  afterEach(async () => {
    await pg.close();
  });

  test("createBudget inserts a positive-amount row and returns it", async () => {
    const row = await createBudget(db as never, {
      projectId: PROJECT_A,
      tokenId: "near",
      amount: "1000",
      note: "kickoff",
      actorAccountId: "alice.near",
    });
    expect(row.projectId).toBe(PROJECT_A);
    expect(row.tokenId).toBe("near");
    expect(row.amount).toBe("1000");
    expect(row.note).toBe("kickoff");
    expect(row.actorAccountId).toBe("alice.near");
    expect(row.relatedBudgetId).toBeNull();
    expect(row.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("deallocateBudget inserts the negated amount as a correction row", async () => {
    await createBudget(db as never, {
      projectId: PROJECT_A,
      tokenId: "near",
      amount: "1000",
      note: "kickoff",
      actorAccountId: "alice.near",
    });
    const row = await deallocateBudget(db as never, {
      projectId: PROJECT_A,
      tokenId: "near",
      amount: "750",
      note: "scope-cut",
      actorAccountId: "alice.near",
    });
    expect(row.amount).toBe("-750");
    expect(row.note).toBe("scope-cut");
  });

  test("deallocateBudget rejects when the running sum would go negative", async () => {
    await createBudget(db as never, {
      projectId: PROJECT_A,
      tokenId: "near",
      amount: "100",
      note: "small budget",
      actorAccountId: "alice.near",
    });
    await expect(
      deallocateBudget(db as never, {
        projectId: PROJECT_A,
        tokenId: "near",
        amount: "200",
        note: "overspend",
        actorAccountId: "alice.near",
      }),
    ).rejects.toBeInstanceOf(BudgetInsufficientError);
  });

  test("deallocateBudget guard is per-(project, token) — another token isn't affected", async () => {
    await createBudget(db as never, {
      projectId: PROJECT_A,
      tokenId: "near",
      amount: "100",
      note: "near budget",
      actorAccountId: "alice.near",
    });
    // No USDC budget exists; deallocating USDC must reject (sum 0 - 1 < 0)
    await expect(
      deallocateBudget(db as never, {
        projectId: PROJECT_A,
        tokenId: "usdc.tkn.primitives.near",
        amount: "1",
        note: "wrong-token",
        actorAccountId: "alice.near",
      }),
    ).rejects.toBeInstanceOf(BudgetInsufficientError);
  });

  test("transferBudget inserts paired rows linked by relatedBudgetId", async () => {
    await createBudget(db as never, {
      projectId: PROJECT_A,
      tokenId: "near",
      amount: "1000",
      note: "source budget",
      actorAccountId: "alice.near",
    });
    const { from, to } = await transferBudget(db as never, {
      fromProjectId: PROJECT_A,
      toProjectId: PROJECT_B,
      tokenId: "near",
      amount: "500",
      note: "reallocation",
      actorAccountId: "alice.near",
    });
    expect(from.projectId).toBe(PROJECT_A);
    expect(from.amount).toBe("-500");
    expect(to.projectId).toBe(PROJECT_B);
    expect(to.amount).toBe("500");
    expect(from.relatedBudgetId).toBe(to.id);
    expect(to.relatedBudgetId).toBe(from.id);
    expect(from.createdAt.getTime()).toBe(to.createdAt.getTime());
  });

  test("transferBudget rejects when the source side would go negative", async () => {
    await createBudget(db as never, {
      projectId: PROJECT_A,
      tokenId: "near",
      amount: "100",
      note: "small source",
      actorAccountId: "alice.near",
    });
    await expect(
      transferBudget(db as never, {
        fromProjectId: PROJECT_A,
        toProjectId: PROJECT_B,
        tokenId: "near",
        amount: "200",
        note: "overdraft",
        actorAccountId: "alice.near",
      }),
    ).rejects.toBeInstanceOf(BudgetInsufficientError);
  });

  test("listBudgets returns rows for the given projects in createdAt desc order", async () => {
    await createBudget(db as never, {
      projectId: PROJECT_A,
      tokenId: "near",
      amount: "1",
      note: "first",
      actorAccountId: "alice.near",
    });
    await new Promise((r) => setTimeout(r, 5));
    await createBudget(db as never, {
      projectId: PROJECT_A,
      tokenId: "near",
      amount: "2",
      note: "second",
      actorAccountId: "alice.near",
    });
    await new Promise((r) => setTimeout(r, 5));
    await createBudget(db as never, {
      projectId: PROJECT_B,
      tokenId: "near",
      amount: "3",
      note: "other-project",
      actorAccountId: "alice.near",
    });

    const out = await listBudgets(db as never, {
      projectIds: [PROJECT_A, PROJECT_B],
      limit: 50,
    });
    expect(out.data).toHaveLength(3);
    expect(out.data.map((r) => r.note)).toEqual(["other-project", "second", "first"]);
    expect(out.nextCursor).toBeNull();
  });

  test("listBudgets scopes by projectIds — out-of-scope projects are excluded", async () => {
    await createBudget(db as never, {
      projectId: PROJECT_A,
      tokenId: "near",
      amount: "1",
      note: "in",
      actorAccountId: "alice.near",
    });
    await createBudget(db as never, {
      projectId: PROJECT_C,
      tokenId: "near",
      amount: "1",
      note: "out",
      actorAccountId: "alice.near",
    });

    const out = await listBudgets(db as never, { projectIds: [PROJECT_A], limit: 50 });
    expect(out.data).toHaveLength(1);
    expect(out.data[0]?.note).toBe("in");
  });

  test("listBudgets returns empty when projectIds is empty without hitting the DB", async () => {
    await createBudget(db as never, {
      projectId: PROJECT_A,
      tokenId: "near",
      amount: "1",
      note: "x",
      actorAccountId: "alice.near",
    });
    const out = await listBudgets(db as never, { projectIds: [], limit: 50 });
    expect(out.data).toEqual([]);
    expect(out.nextCursor).toBeNull();
  });

  test("listBudgets filters by tokenId when provided", async () => {
    await createBudget(db as never, {
      projectId: PROJECT_A,
      tokenId: "near",
      amount: "1",
      note: "n",
      actorAccountId: "alice.near",
    });
    await createBudget(db as never, {
      projectId: PROJECT_A,
      tokenId: "usdc.tkn.primitives.near",
      amount: "1",
      note: "u",
      actorAccountId: "alice.near",
    });

    const near = await listBudgets(db as never, {
      projectIds: [PROJECT_A],
      tokenId: "near",
      limit: 50,
    });
    expect(near.data).toHaveLength(1);
    expect(near.data[0]?.note).toBe("n");
  });

  test("listBudgets paginates: limit + cursor walks all rows in order", async () => {
    for (let i = 0; i < 5; i++) {
      await createBudget(db as never, {
        projectId: PROJECT_A,
        tokenId: "near",
        amount: String(i),
        note: `r${i}`,
        actorAccountId: "alice.near",
      });
      await new Promise((r) => setTimeout(r, 2));
    }

    const seen: string[] = [];
    let cursor: string | undefined;
    for (let safety = 0; safety < 10; safety++) {
      const out = await listBudgets(db as never, {
        projectIds: [PROJECT_A],
        limit: 2,
        cursor,
      });
      for (const row of out.data) seen.push(row.note ?? "");
      if (!out.nextCursor) break;
      cursor = out.nextCursor;
    }
    expect(seen).toEqual(["r4", "r3", "r2", "r1", "r0"]);
  });
});
