const NEARN_BASE = "https://nearn.io";

export function nearnListingUrl(slug: string): string {
  return `${NEARN_BASE}/listing/${slug}`;
}

export function nearnSponsorUrl(sponsorSlug: string): string {
  return `${NEARN_BASE}/${sponsorSlug}/`;
}

type NearnRewardShape = {
  compensationType?: string | null;
  rewardAmount?: number | null;
  minRewardAsk?: number | null;
  maxRewardAsk?: number | null;
  token?: string | null;
};

// compensationType: variable (sponsorships, no fixed pool) | range (asks bounded) | fixed (single prize).
export function formatNearnReward(n: NearnRewardShape): string {
  if (n.compensationType === "variable") {
    if (n.rewardAmount != null && n.token) return `variable · up to ${n.rewardAmount} ${n.token}`;
    return "variable";
  }
  if (
    n.compensationType === "range" &&
    n.minRewardAsk != null &&
    n.maxRewardAsk != null &&
    n.token
  ) {
    return `${n.minRewardAsk}–${n.maxRewardAsk} ${n.token}`;
  }
  if (n.rewardAmount != null && n.token) return `${n.rewardAmount} ${n.token}`;
  return "—";
}
