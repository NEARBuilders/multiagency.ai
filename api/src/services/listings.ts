import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "../db";
import { type Listing, listings, type NewListing } from "../db/schema";
import { getNearnListing, isNearnAvailable, type NearnListing, NearnNotFoundError } from "./nearn";

const LISTING_STALENESS_MS = 5 * 60_000;

// Surfaces "NEARN slug already taken" cleanly so handlers can show the conflicting project.
export class NearnListingConflictError extends Error {
  constructor(
    readonly slug: string,
    readonly conflictingProjectId: string,
  ) {
    super(`NEARN listing "${slug}" is already attached to project ${conflictingProjectId}`);
    this.name = "NearnListingConflictError";
  }
}

type ListingDataFields = Pick<
  NewListing,
  | "title"
  | "description"
  | "type"
  | "status"
  | "token"
  | "rewardAmount"
  | "deadline"
  | "isPublished"
  | "isArchived"
  | "isWinnersAnnounced"
  | "sponsorName"
  | "sponsorSlug"
  | "sponsorLogo"
  | "sponsorVerified"
>;

// Number→BigInt precision-bounded: |n|≥1e21 → null; |n|<1e-6 uses toFixed (may carry IEEE-754 low-order noise).
function numberToDecimalString(n: number): string | null {
  if (!Number.isFinite(n)) return null;
  const s = String(n);
  if (!/[eE]/.test(s)) return s;
  if (Math.abs(n) >= 1e21) {
    console.warn("[listings] rewardAmount lost precision (≥1e21); dropping from rollup math:", n);
    return null;
  }
  return n.toFixed(24).replace(/\.?0+$/, "");
}

export function mapNearnPayloadToListingFields(payload: NearnListing): ListingDataFields {
  return {
    title: payload.title,
    description: payload.description,
    type: payload.type,
    status: payload.status,
    token: payload.token,
    rewardAmount:
      payload.rewardAmount === null ? null : numberToDecimalString(payload.rewardAmount),
    deadline: payload.deadline ? new Date(payload.deadline) : null,
    isPublished: payload.isPublished,
    isArchived: payload.isArchived,
    isWinnersAnnounced: payload.isWinnersAnnounced,
    sponsorName: payload.sponsor?.name ?? null,
    sponsorSlug: payload.sponsor?.slug ?? null,
    sponsorLogo: payload.sponsor?.logo ?? null,
    sponsorVerified: payload.sponsor?.isVerified ?? null,
  };
}

export function listingRowToNearnPayload(row: Listing): NearnListing | null {
  if (row.source !== "nearn" || !row.externalId) return null;
  return {
    slug: row.externalId,
    title: row.title,
    description: row.description,
    type: row.type,
    status: row.status,
    token: row.token,
    rewardAmount: row.rewardAmount === null ? null : Number(row.rewardAmount),
    deadline: row.deadline ? row.deadline.toISOString() : null,
    isPublished: row.isPublished,
    isArchived: row.isArchived,
    isWinnersAnnounced: row.isWinnersAnnounced,
    sponsor:
      row.sponsorName !== null || row.sponsorSlug !== null
        ? {
            name: row.sponsorName,
            slug: row.sponsorSlug,
            logo: row.sponsorLogo,
            isVerified: row.sponsorVerified,
          }
        : null,
  };
}

// Refresh cached NEARN payload by slug; 404 → isArchived=true; testnet no-ops.
export async function refreshNearnListing(
  slug: string,
  orgAccountId: string,
  db: Database,
): Promise<Listing | null> {
  const existing = await db
    .select()
    .from(listings)
    .where(and(eq(listings.source, "nearn"), eq(listings.externalId, slug)))
    .limit(1);
  const row = existing[0];
  if (!row) return null;
  if (!isNearnAvailable(orgAccountId)) return row;

  const now = new Date();
  try {
    const payload = await getNearnListing(slug);
    const fields = mapNearnPayloadToListingFields(payload);
    const [updated] = await db
      .update(listings)
      .set({ ...fields, syncedAt: now, updatedAt: now })
      .where(eq(listings.id, row.id))
      .returning();
    return updated ?? row;
  } catch (err) {
    if (err instanceof NearnNotFoundError) {
      const [updated] = await db
        .update(listings)
        .set({ isArchived: true, syncedAt: now, updatedAt: now })
        .where(eq(listings.id, row.id))
        .returning();
      return updated ?? row;
    }
    throw err;
  }
}

// Attach NEARN listing; upserts by (project_id, source); throws if NEARN unavailable.
// Pre-checks `(source, externalId)` to surface a typed conflict error before NEARN fetch.
export async function attachNearnListing(
  projectId: string,
  slug: string,
  db: Database,
): Promise<Listing> {
  const collision = await db
    .select({ projectId: listings.projectId })
    .from(listings)
    .where(and(eq(listings.source, "nearn"), eq(listings.externalId, slug)))
    .limit(1);
  if (collision[0] && collision[0].projectId !== projectId) {
    throw new NearnListingConflictError(slug, collision[0].projectId);
  }

  const payload = await getNearnListing(slug);
  const fields = mapNearnPayloadToListingFields(payload);
  const now = new Date();
  const [row] = await db
    .insert(listings)
    .values({
      id: crypto.randomUUID(),
      projectId,
      source: "nearn",
      externalId: slug,
      ...fields,
      syncedAt: now,
    })
    .onConflictDoUpdate({
      target: [listings.projectId, listings.source],
      set: { externalId: slug, ...fields, syncedAt: now, updatedAt: now },
    })
    .returning();
  if (!row) throw new Error("listings upsert returned no row");
  return row;
}

export async function detachNearnListing(projectId: string, db: Database): Promise<void> {
  await db
    .delete(listings)
    .where(and(eq(listings.projectId, projectId), eq(listings.source, "nearn")));
}

// Cascade project status to every listing (both sources). Idempotent.
export async function setListingsArchived(
  projectId: string,
  isArchived: boolean,
  db: Database,
): Promise<void> {
  await db
    .update(listings)
    .set({ isArchived, updatedAt: new Date() })
    .where(eq(listings.projectId, projectId));
}

export function isStale(row: Listing): boolean {
  if (!row.syncedAt) return true;
  return Date.now() - row.syncedAt.getTime() > LISTING_STALENESS_MS;
}

async function maybeRefresh(row: Listing, orgAccountId: string, db: Database): Promise<Listing> {
  if (row.source !== "nearn" || !row.externalId || !isStale(row)) return row;
  if (!isNearnAvailable(orgAccountId)) return row;
  try {
    const refreshed = await refreshNearnListing(row.externalId, orgAccountId, db);
    return refreshed ?? row;
  } catch (err) {
    console.warn(`[listings] refresh failed for slug=${row.externalId}:`, err);
    return row;
  }
}

export interface GetListingOpts {
  skipRefresh?: boolean;
}

export async function getListingForProject(
  projectId: string,
  source: "nearn" | "internal",
  orgAccountId: string,
  db: Database,
  opts: GetListingOpts = {},
): Promise<Listing | null> {
  const rows = await db
    .select()
    .from(listings)
    .where(and(eq(listings.projectId, projectId), eq(listings.source, source)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (opts.skipRefresh) return row;
  return maybeRefresh(row, orgAccountId, db);
}

export async function getListingsForProjects(
  projectIds: string[],
  source: "nearn" | "internal",
  orgAccountId: string,
  db: Database,
  opts: GetListingOpts = {},
): Promise<Map<string, Listing>> {
  if (projectIds.length === 0) return new Map();
  const rows = await db
    .select()
    .from(listings)
    .where(and(inArray(listings.projectId, projectIds), eq(listings.source, source)));
  if (opts.skipRefresh) {
    return new Map(rows.map((r) => [r.projectId, r]));
  }
  const fresh = await Promise.all(rows.map((r) => maybeRefresh(r, orgAccountId, db)));
  return new Map(fresh.map((r) => [r.projectId, r]));
}
