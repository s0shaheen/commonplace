// Serial rate limiter for KB endpoints. Each KB has a courtesy budget the USER's IP owns:
// MusicBrainz is a hard 1 req/s, Wikidata/Places ~5 req/s. This serializes every call through
// one FIFO chain and spaces consecutive STARTS by at least `minIntervalMs`, so a burst of
// grounding lookups can't trip a KB's limiter. Order in == order out; a rejected call does not
// stall the queue.
export function createRateLimiter(minIntervalMs: number): <T>(fn: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve();
  // Sentinel so the very first call runs immediately (−∞ + interval is still ≤ now).
  let lastStart = Number.NEGATIVE_INFINITY;

  return function schedule<T>(fn: () => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      const wait = lastStart + minIntervalMs - Date.now();
      if (wait > 0) await delay(wait);
      lastStart = Date.now();
      return fn();
    };
    // Chain off the tail so calls are serialized; run regardless of the previous outcome.
    const result = tail.then(run, run);
    // Keep the queue alive after a rejection (swallow only for the *chaining* promise).
    tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
