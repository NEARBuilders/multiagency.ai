export type Network = "mainnet" | "testnet";

export function pinnedNetwork(): Network | null {
  const v = process.env.NEAR_NETWORK?.toLowerCase();
  return v === "testnet" || v === "mainnet" ? (v as Network) : null;
}
