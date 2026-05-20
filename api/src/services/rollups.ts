import type { Listing } from "../db/schema";
import type { DaoProposalStatus as ProposalStatus } from "./sputnik";
import { displayToBaseUnits, getTokenMetadataBySymbol } from "./tokens";

export type { ProposalStatus };

export const PROPOSAL_TERMINAL_FAIL = new Set<ProposalStatus>([
  "Rejected",
  "Removed",
  "Expired",
  "Moved",
  "Failed",
]);

export type ResolvedListing = {
  tokenId: string;
  baseAmount: bigint;
  isWinnersAnnounced: boolean;
};

export type BillingForRollup = {
  amount: string;
  status: ProposalStatus;
};

export type TokenRollup = {
  tokenId: string;
  budget: bigint;
  allocated: bigint;
  committed: bigint;
  paid: bigint;
  remaining: bigint;
};

// Active listing for rollup math; NEARN > internal; null if no published+known-token entry.
// Token symbol resolves within the deployment network — testnet listings need testnet entries.
export function resolveActiveListing(
  nearnListing: Listing | null,
  internalListing: Listing | null,
  network: "mainnet" | "testnet" = "mainnet",
): ResolvedListing | null {
  const active = nearnListing ?? internalListing;
  if (!active) return null;
  if (active.isPublished !== true || active.isArchived !== false) return null;
  if (!active.token || !active.rewardAmount) return null;
  const known = getTokenMetadataBySymbol(active.token, network);
  if (!known) return null;
  return {
    tokenId: known.tokenId,
    baseAmount: displayToBaseUnits(active.rewardAmount, known.decimals),
    isWinnersAnnounced: active.isWinnersAnnounced === true,
  };
}

// Per-token rollup; pass null listing when off-token (function also guards internally).
export function rollupForToken(input: {
  tokenId: string;
  budgetAmounts: bigint[];
  billings: BillingForRollup[];
  listing: ResolvedListing | null;
}): TokenRollup {
  const matchingListing =
    input.listing && input.listing.tokenId === input.tokenId ? input.listing : null;
  const tokenBills = input.billings.filter((b) => !PROPOSAL_TERMINAL_FAIL.has(b.status));

  const sumBills = (predicate: (b: BillingForRollup) => boolean) =>
    tokenBills.filter(predicate).reduce((acc, b) => acc + BigInt(b.amount), 0n);

  const budget = input.budgetAmounts.reduce((acc, a) => acc + a, 0n);
  const inProgressBillings = sumBills((b) => b.status === "InProgress");
  const paid = sumBills((b) => b.status === "Approved");

  let listingAllocated = 0n;
  let listingCommitted = 0n;
  if (matchingListing) {
    if (matchingListing.isWinnersAnnounced) {
      // Any non-failed billing: billing carries committed/paid; listing→0 to avoid double-count.
      if (tokenBills.length === 0) listingCommitted = matchingListing.baseAmount;
    } else {
      listingAllocated = matchingListing.baseAmount;
    }
  }

  const allocated = listingAllocated;
  const committed = listingCommitted + inProgressBillings;
  const remaining = budget - allocated - committed - paid;

  return { tokenId: input.tokenId, budget, allocated, committed, paid, remaining };
}

// Agency-rollup-only: available = balance - (budgeted - paid).
export function computeAvailable(balance: bigint, budgeted: bigint, paid: bigint): bigint {
  return balance - (budgeted - paid);
}

export type ProjectBudgetRow = { projectId: string; tokenId: string; amount: string };
export type ProjectBillingRow = {
  projectId: string;
  tokenId: string;
  amount: string;
  status: ProposalStatus;
};

export interface AgencyRollupItem {
  tokenId: string;
  balance: string;
  budgeted: string;
  allocated: string;
  committed: string;
  paid: string;
  remaining: string;
  available: string;
}

// Sum per-token rollups across projects, fold in balances; sorted by tokenId.
export function assembleAgencyRollups(input: {
  projectIds: string[];
  budgetRows: ProjectBudgetRow[];
  billingRows: ProjectBillingRow[];
  nearnListings: Map<string, Listing>;
  internalListings: Map<string, Listing>;
  balances: Record<string, string>;
  network?: "mainnet" | "testnet";
}): AgencyRollupItem[] {
  type TokenTotals = { budgeted: bigint; allocated: bigint; committed: bigint; paid: bigint };
  const zero = (): TokenTotals => ({
    budgeted: 0n,
    allocated: 0n,
    committed: 0n,
    paid: 0n,
  });
  const totalsByToken = new Map<string, TokenTotals>();

  for (const projectId of input.projectIds) {
    const projectBudgets = input.budgetRows.filter((b) => b.projectId === projectId);
    const projectBills = input.billingRows.filter((b) => b.projectId === projectId);
    const resolved = resolveActiveListing(
      input.nearnListings.get(projectId) ?? null,
      input.internalListings.get(projectId) ?? null,
      input.network,
    );
    const projectTokens = Array.from(
      new Set([
        ...projectBudgets.map((b) => b.tokenId),
        ...projectBills.map((b) => b.tokenId),
        ...(resolved ? [resolved.tokenId] : []),
      ]),
    );
    for (const tokenId of projectTokens) {
      const r = rollupForToken({
        tokenId,
        budgetAmounts: projectBudgets
          .filter((b) => b.tokenId === tokenId)
          .map((b) => BigInt(b.amount)),
        billings: projectBills
          .filter((b) => b.tokenId === tokenId)
          .map((b) => ({ amount: b.amount, status: b.status })),
        listing: resolved,
      });
      const totals = totalsByToken.get(tokenId) ?? zero();
      totals.budgeted += r.budget;
      totals.allocated += r.allocated;
      totals.committed += r.committed;
      totals.paid += r.paid;
      totalsByToken.set(tokenId, totals);
    }
  }

  const tokenIds = Array.from(totalsByToken.keys()).sort();
  return tokenIds.map((tokenId) => {
    const totals = totalsByToken.get(tokenId) ?? zero();
    const balance = BigInt(input.balances[tokenId] ?? "0");
    const remaining = totals.budgeted - totals.allocated - totals.committed - totals.paid;
    const available = computeAvailable(balance, totals.budgeted, totals.paid);
    return {
      tokenId,
      balance: balance.toString(),
      budgeted: totals.budgeted.toString(),
      allocated: totals.allocated.toString(),
      committed: totals.committed.toString(),
      paid: totals.paid.toString(),
      remaining: remaining.toString(),
      available: available.toString(),
    };
  });
}

// Distinct token ids; useful for pre-fetching balances before assembleAgencyRollups.
export function tokenIdsForRollup(input: {
  projectIds: string[];
  budgetRows: ProjectBudgetRow[];
  billingRows: ProjectBillingRow[];
  nearnListings: Map<string, Listing>;
  internalListings: Map<string, Listing>;
  network?: "mainnet" | "testnet";
}): string[] {
  const tokens = new Set<string>();
  for (const b of input.budgetRows) tokens.add(b.tokenId);
  for (const b of input.billingRows) tokens.add(b.tokenId);
  for (const projectId of input.projectIds) {
    const resolved = resolveActiveListing(
      input.nearnListings.get(projectId) ?? null,
      input.internalListings.get(projectId) ?? null,
      input.network,
    );
    if (resolved) tokens.add(resolved.tokenId);
  }
  return Array.from(tokens).sort();
}
