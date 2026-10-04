import { beforeEach, describe, expect, it, vi } from "vitest";

// redisGetSWR talks to Redis and a loader; both are stubbed so the test covers
// only the cache contract, in particular what happens when the loader fails.
const state = vi.hoisted(() => ({
  store: new Map<string, string>(),
}));

vi.mock("../src/services/redis", () => ({
  getRedis: () => ({
    get: async (k: string) => state.store.get(k) ?? null,
    set: async (k: string, v: string) => {
      state.store.set(k, v);
      return "OK";
    },
  }),
}));

import { forgetLastKnownGood, redisGetSWR } from "../src/services/cache-swr";

/** Builds the cache envelope by hand so a test can backdate an entry. */
function envelope(data: unknown, savedAt: number): string {
  return JSON.stringify({ v: 1, data, savedAt });
}

describe("redisGetSWR serving stale data on failure", () => {
  beforeEach(() => {
    state.store.clear();
    forgetLastKnownGood("k1");
  });

  it("loads through and remembers the value", async () => {
    const inflight = new Map<string, Promise<unknown>>();
    const refresh = new Map<string, Promise<void>>();
    const out = await redisGetSWR<string[]>(
      "k1",
      60,
      undefined,
      async () => ["a"],
      inflight,
      refresh,
    );
    expect(out).toEqual(["a"]);
  });

  it("serves the remembered value when the loader later fails", async () => {
    const inflight = new Map<string, Promise<unknown>>();
    const refresh = new Map<string, Promise<void>>();
    await redisGetSWR<string[]>(
      "k1",
      60,
      undefined,
      async () => ["good"],
      inflight,
      refresh,
    );

    // Upstream breaks and the cached entry is gone (TTL expired / Redis flushed).
    state.store.clear();

    const out = await redisGetSWR<string[]>(
      "k1",
      60,
      undefined,
      async () => {
        throw new Error("upstream down");
      },
      inflight,
      refresh,
    );
    expect(out).toEqual(["good"]);
  });

  it("rethrows when there is nothing to fall back on", async () => {
    const inflight = new Map<string, Promise<unknown>>();
    const refresh = new Map<string, Promise<void>>();
    forgetLastKnownGood("fresh");
    await expect(
      redisGetSWR<string[]>(
        "fresh",
        60,
        undefined,
        async () => {
          throw new Error("upstream down");
        },
        inflight,
        refresh,
      ),
    ).rejects.toThrow("upstream down");
  });

  it("returns the cached entry without calling the loader", async () => {
    const inflight = new Map<string, Promise<unknown>>();
    const refresh = new Map<string, Promise<void>>();
    state.store.set("k1", envelope(["cached-track"], Date.now()));
    const loader = vi.fn(async () => ["never"]);
    const out = await redisGetSWR<string[]>(
      "k1",
      60,
      undefined,
      loader,
      inflight,
      refresh,
    );
    expect(out).toEqual(["cached-track"]);
    expect(loader).not.toHaveBeenCalled();
  });
});
describe("soft TTL is derived from the entry TTL", () => {
  beforeEach(() => {
    state.store.clear();
    forgetLastKnownGood("sw");
    vi.useRealTimers();
  });

  it("does not refresh a long-lived entry on every read", async () => {
    const inflight = new Map<string, Promise<unknown>>();
    const refresh = new Map<string, Promise<void>>();
    const loader = vi.fn(async () => ["fresh"]);

    // One day of TTL, written long ago: a flat 30-minute soft TTL would kick off
    // a YouTube fetch here, a proportional one leaves the value alone.
    state.store.set("sw", envelope(["cached"], Date.now() - 60 * 60 * 1000));
    const out = await redisGetSWR<string[]>(
      "sw",
      86_400,
      undefined,
      loader,
      inflight,
      refresh,
    );

    expect(out).toEqual(["cached"]);
    expect(loader).not.toHaveBeenCalled();
  });

  it("refreshes a short-lived entry once it passes its soft age", async () => {
    const inflight = new Map<string, Promise<unknown>>();
    const refresh = new Map<string, Promise<void>>();
    const loader = vi.fn(async () => ["fresh"]);

    // 20-minute TTL -> soft age of 12 minutes; this entry is older than that.
    state.store.set("sw", envelope(["cached"], Date.now() - 15 * 60 * 1000));
    const out = await redisGetSWR<string[]>(
      "sw",
      1200,
      undefined,
      loader,
      inflight,
      refresh,
    );

    // The stale value is returned immediately; the refresh happens behind it.
    expect(out).toEqual(["cached"]);
    expect(loader).toHaveBeenCalledTimes(1);
  });
});
