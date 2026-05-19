// Per-request network: NEAR_NETWORK env > X-Network header > mainnet default.
// Client sets the header via the apiClient fetch wrapper; SSR loaders propagate it
// from the URL `?network=` param at the router boundary.
import { type Network, pinnedNetwork } from "./default-org-account";

export const NETWORK_HEADER = "x-network";

export function getNetwork(reqHeaders: Headers | undefined): Network {
  const pinned = pinnedNetwork();
  if (pinned) return pinned;
  const header = reqHeaders?.get(NETWORK_HEADER);
  if (header === "testnet") return "testnet";
  if (header === "mainnet") return "mainnet";
  return "mainnet";
}
