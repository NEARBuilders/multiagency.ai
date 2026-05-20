import type { ClientRuntimeConfig } from "everything-dev/types";
import { getRuntimeConfig } from "everything-dev/ui/runtime";

type Network = "mainnet" | "testnet";

// Carries the active network to the server via a cookie (not a header) so it rides the api
// client's existing `credentials: "include"` AND the SSR document request — meaning NO edit
// to the framework-synced @/lib/api or @/lib/auth. Server-side reader: api/src/lib/network.ts.
const NETWORK_COOKIE = "agency_view_network";

function readRuntimeConfig(config?: Partial<ClientRuntimeConfig>) {
  if (config) return config;
  if (typeof window === "undefined") return undefined;
  try {
    return getRuntimeConfig();
  } catch {
    return undefined;
  }
}

function cookieNetwork(): Network | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)agency_view_network=(mainnet|testnet)/);
  return m ? (m[1] as Network) : null;
}

// Fork-owned multi-network resolution. Lives here (NOT in framework-synced @/lib/auth, which
// bos sync overwrites) so the toggle survives upgrades. URL `?network=` is canonical; the
// cookie is next-session memory; runtime config / account suffix is the fallback.
export function getNetwork(config?: Partial<ClientRuntimeConfig>): Network {
  if (typeof window !== "undefined") {
    const fromUrl = new URLSearchParams(window.location.search).get("network");
    if (fromUrl === "mainnet" || fromUrl === "testnet") return fromUrl;
    const fromCookie = cookieNetwork();
    if (fromCookie) return fromCookie;
  }
  const cfg = readRuntimeConfig(config);
  if (cfg?.networkId === "mainnet" || cfg?.networkId === "testnet") return cfg.networkId;
  return (cfg?.account ?? "every.near").endsWith(".testnet") ? "testnet" : "mainnet";
}

export async function setNetwork(network: Network): Promise<void> {
  if (typeof window === "undefined") return;
  if (getNetwork() === network) return;
  // Cookie carries the choice to the server (sent via credentials:include + the SSR request).
  document.cookie = `${NETWORK_COOKIE}=${network}; path=/; max-age=31536000; samesite=lax; secure`;
  // URL is authoritative; full reload so SSR loaders re-fetch on the new network's shell.
  const url = new URL(window.location.href);
  url.searchParams.set("network", network);
  window.location.href = url.toString();
}
