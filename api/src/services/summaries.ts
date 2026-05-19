import type { DaoProposalStatus, DaoRole } from "./sputnik";
import { NATIVE_TOKEN_ID } from "./tokens";

export interface ProposalSummary {
  openCount: number;
  totalCount: number;
}

export interface TreasurySummary {
  nearBalance: string;
  ftTokens: number;
}

export interface TeamSummary {
  roleCount: number;
  memberCount: number;
}

export function summarizeProposals(
  recent: { status: DaoProposalStatus }[],
  lastProposalId: number,
): ProposalSummary {
  const openCount = recent.filter((p) => p.status === "InProgress").length;
  return { openCount, totalCount: lastProposalId };
}

export function summarizeTreasury(
  balances: Record<string, string>,
  tokenIds: string[],
): TreasurySummary {
  const ftTokens = tokenIds.filter((id) => id !== NATIVE_TOKEN_ID).length;
  return { nearBalance: balances[NATIVE_TOKEN_ID] ?? "0", ftTokens };
}

// Distinct members across non-Everyone roles; explicit filter guards upstream changes.
export function summarizeTeam(roles: DaoRole[]): TeamSummary {
  const uniqueMembers = new Set<string>();
  for (const role of roles) {
    if (!role.isEveryone) for (const m of role.members) uniqueMembers.add(m);
  }
  return { roleCount: roles.length, memberCount: uniqueMembers.size };
}
