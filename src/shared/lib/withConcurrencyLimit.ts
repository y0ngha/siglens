/**
 * Run `fn` over each item in `items`, at most `limit` items concurrently.
 * Returns settled results in input order, identical to `Promise.allSettled`.
 *
 * Uses a loop-slice (chunked) strategy rather than a sliding-window semaphore.
 * This is intentionally simpler: it avoids adding `p-limit` as a dependency
 * and is sufficient for the O(50) item sizes used in market-news and economy
 * analysis batches. Each chunk of `limit` items runs fully in parallel; the
 * next chunk starts only after the current one settles.
 *
 * @param items  Input array to process. Empty input returns `[]` immediately.
 * @param limit  Maximum number of concurrent promises per chunk. Must be ≥ 1.
 * @param fn     Async function applied to each item. Errors are captured as
 *               `PromiseSettledResult<R>` with `status:'rejected'` — they do
 *               NOT propagate to the caller.
 */
export async function withConcurrencyLimit<T, R>(
    items: T[],
    limit: number,
    fn: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
    const results: PromiseSettledResult<R>[] = [];
    const total = items.length;
    for (let i = 0; i < total; i += limit) {
        const chunk = items.slice(i, i + limit);
        // reduce+spread는 .then 체이닝이 필요해 명료성 이득이 없어 for-loop+push를 택했다.
        results.push(...(await Promise.allSettled(chunk.map(fn))));
    }
    return results;
}
