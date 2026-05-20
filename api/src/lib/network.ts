// Per-request network: NEAR_NETWORK env pin > agency_view_network cookie > mainnet default.
// The client sets the cookie (ui/src/lib/network.ts setNetwork); it rides the api client's
// credentials:include and the SSR document request, so no framework-synced file is touched.
import { type Network, pinnedNetwork } from "./default-org-account";

export function getNetwork(reqHeaders: Headers | undefined): Network {
  const pinned = pinnedNetwork();
  if (pinned) return pinned;
  const m = reqHeaders?.get("cookie")?.match(/(?:^|;\s*)agency_view_network=(mainnet|testnet)/);
  if (m) return m[1] as Network;
  return "mainnet";
}
