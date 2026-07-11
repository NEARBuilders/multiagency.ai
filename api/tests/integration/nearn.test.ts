import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  getNearnListingSubmissions,
  listNearnBountiesForSponsor,
  NearnNotFoundError,
} from "../../src/services/nearn";

const ok = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

describe("listNearnBountiesForSponsor — response-shape regression", () => {
  const originalFetch = globalThis.fetch;
  let calls: Array<[string | URL | Request, RequestInit | undefined]>;
  let queue: Array<() => Promise<Response>>;

  beforeEach(() => {
    calls = [];
    queue = [];
    globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => {
      calls.push([url, init]);
      const next = queue.shift();
      if (!next) throw new Error("unexpected fetch call (queue empty)");
      return next();
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const enqueue = (body: unknown) => queue.push(async () => ok(body));

  test("extracts bounties from { bounties: [...] } envelope", async () => {
    enqueue({
      bounties: [
        {
          slug: "alpha",
          title: "Alpha bounty",
          type: "bounty",
          status: "OPEN",
          token: "USDC",
          rewardAmount: 100,
          deadline: "2026-01-01T00:00:00Z",
          isPublished: true,
          isFeatured: false,
          isWinnersAnnounced: false,
        },
      ],
    });

    const result = await listNearnBountiesForSponsor("sponsor-envelope");

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      slug: "alpha",
      title: "Alpha bounty",
      rewardAmount: 100,
    });
  });

  test("returns [] when bounties array is empty", async () => {
    enqueue({ bounties: [] });
    const result = await listNearnBountiesForSponsor("sponsor-empty");
    expect(result).toEqual([]);
  });

  test("returns [] when response shape lacks the bounties key (defensive)", async () => {
    enqueue({ unexpected: "shape" });
    const result = await listNearnBountiesForSponsor("sponsor-malformed");
    expect(result).toEqual([]);
  });

  test("filters out bounties without a slug", async () => {
    enqueue({
      bounties: [
        { slug: "valid", title: "Has slug" },
        { title: "No slug" },
        { slug: "", title: "Empty slug" },
      ],
    });
    const result = await listNearnBountiesForSponsor("sponsor-mixed");
    expect(result).toHaveLength(1);
    expect(result[0]!.slug).toBe("valid");
  });

  test("calls the trailing-slash URL (avoids 308 redirect)", async () => {
    enqueue({ bounties: [] });
    await listNearnBountiesForSponsor("sponsor-url-check");

    expect(calls[0]![0]).toBe("https://nearn.io/api/listings/sponsor/");
  });
});

describe("getNearnListingSubmissions — response-shape regression", () => {
  const originalFetch = globalThis.fetch;
  let calls: Array<[string | URL | Request, RequestInit | undefined]>;
  let queue: Array<() => Promise<Response>>;

  beforeEach(() => {
    calls = [];
    queue = [];
    globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => {
      calls.push([url, init]);
      const next = queue.shift();
      if (!next) throw new Error("unexpected fetch call (queue empty)");
      return next();
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const enqueue = (body: unknown, status = 200) =>
    queue.push(async () =>
      status === 200
        ? ok(body)
        : new Response(JSON.stringify(body), {
            status,
            headers: { "Content-Type": "application/json" },
          }),
    );

  test("extracts submissions from { submission: [...] } envelope", async () => {
    enqueue({
      bounty: { slug: "sub-envelope" },
      submission: [
        {
          id: "s1",
          userId: "u1",
          user: {
            id: "u1",
            name: "Alice",
            username: "alice",
            publicKey: "alice.near",
            photo: null,
          },
          isWinner: true,
          winnerPosition: 1,
          status: "Approved",
          label: "Reviewed",
          ask: 500,
          token: "USDC",
          rewardInUSD: 500,
          link: "https://example.com/work",
          createdAt: "2026-05-01T00:00:00Z",
        },
      ],
    });

    const result = await getNearnListingSubmissions("sub-envelope");

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "s1",
      userId: "u1",
      user: {
        id: "u1",
        name: "Alice",
        username: "alice",
        publicKey: "alice.near",
        photo: null,
      },
      isWinner: true,
      winnerPosition: 1,
      status: "Approved",
      label: "Reviewed",
      ask: 500,
      token: "USDC",
      rewardInUSD: 500,
      link: "https://example.com/work",
      createdAt: "2026-05-01T00:00:00Z",
    });
  });

  test("returns [] when submission array is empty", async () => {
    enqueue({ bounty: {}, submission: [] });
    const result = await getNearnListingSubmissions("sub-empty");
    expect(result).toEqual([]);
  });

  test("returns [] when response lacks the submission key", async () => {
    enqueue({ bounty: {} });
    const result = await getNearnListingSubmissions("sub-malformed");
    expect(result).toEqual([]);
  });

  test("filters out submissions without an id", async () => {
    enqueue({
      submission: [
        { id: "good", userId: "u" },
        { userId: "no-id" },
        { id: "", userId: "empty-id" },
      ],
    });
    const result = await getNearnListingSubmissions("sub-mixed");
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("good");
  });

  test("404 throws NearnNotFoundError", async () => {
    enqueue({ error: "not found" }, 404);
    await expect(getNearnListingSubmissions("sub-404")).rejects.toBeInstanceOf(NearnNotFoundError);
  });

  test("calls the trailing-slash URL with encoded slug", async () => {
    enqueue({ submission: [] });
    await getNearnListingSubmissions("sub url check");
    expect(calls[0]![0]).toBe("https://nearn.io/api/listings/submissions/sub%20url%20check/");
  });
});
