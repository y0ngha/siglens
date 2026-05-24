/** Per-key in-flight de-duplicator handle: identical keys share a single Promise; entries cleared on settle. */
export interface SingleFlight<V> {
    /** Returns the in-flight Promise for `key` if present, otherwise starts `work()` and tracks it under `key`. */
    run(key: string, work: () => Promise<V>): Promise<V>;
    /** Test-only: clear all in-flight entries (use in beforeEach). */
    _resetForTest(): void;
}

/** Create a per-key {@link SingleFlight} de-duplicator scoped to its closure. */
export function createSingleFlight<V>(): SingleFlight<V> {
    const inFlight = new Map<string, Promise<V>>();
    return {
        run(key, work) {
            const existing = inFlight.get(key);
            if (existing) return existing;
            const promise = work().finally(() => {
                inFlight.delete(key);
            });
            inFlight.set(key, promise);
            return promise;
        },
        _resetForTest() {
            inFlight.clear();
        },
    };
}
