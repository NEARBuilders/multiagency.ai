import { eq } from "drizzle-orm";
import type { Database } from "../db";
import { billings, budgets, listings, projectContributors } from "../db/schema";

/**
 * Cascade-delete every off-chain row scoped to a project, in a single transaction.
 *
 * SPEC commitment: deleting a project deletes its `agency.billings`,
 * `agency.budgets`, `agency.projectContributors`, and `agency.listings` rows.
 * The on-chain audit trail survives independently — billings stored a 1:1 pointer
 * to a Sputnik proposal, and chain history is reachable via that proposalId even
 * after the local pointer is gone.
 *
 * Order isn't load-bearing for correctness (all four use plain-text `projectId`
 * without FK constraints), but the transaction wrapper IS — partial failure must
 * roll back so re-running the caller picks up a clean slate.
 *
 * Used by `agency.projects.adminDelete` and exercised by its integration test.
 * If you add a new project-scoped table, add it here.
 */
export async function deleteProjectCascade(db: Database, projectId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(billings).where(eq(billings.projectId, projectId));
    await tx.delete(budgets).where(eq(budgets.projectId, projectId));
    await tx.delete(projectContributors).where(eq(projectContributors.projectId, projectId));
    await tx.delete(listings).where(eq(listings.projectId, projectId));
  });
}
