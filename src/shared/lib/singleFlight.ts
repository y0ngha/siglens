/** Per-key in-flight de-duplicator handle: identical keys share a single Promise; entries cleared on settle. */
export interface SingleFlight<V> {
    /** Returns the in-flight Promise for `key` if present, otherwise starts `work()` and tracks it under `key`. */
    run(key: string, work: () => Promise<V>): Promise<V>;
}

// Keyed by instance so the reset stays out of the production `SingleFlight`
// interface (repo convention: test resets are a separate `__reset*ForTests`
// export, never a method on the returned object — see e.g.
// `__resetInFlightForTests` in `shared/cache/getOrSetCache.ts`).
const resetHandles = new WeakMap<SingleFlight<never>, () => void>();

/** Create a per-key {@link SingleFlight} de-duplicator scoped to its closure. */
export function createSingleFlight<V>(): SingleFlight<V> {
    const inFlight = new Map<string, Promise<V>>();
    const instance: SingleFlight<V> = {
        run(key, work) {
            const existing = inFlight.get(key);
            if (existing) return existing;
            const promise = work().finally(() => {
                inFlight.delete(key);
            });
            inFlight.set(key, promise);
            return promise;
        },
    };
    resetHandles.set(instance as SingleFlight<never>, () => inFlight.clear());
    return instance;
}

/** Test-only: clear `instance`'s in-flight entries (use in beforeEach). */
export function __resetSingleFlightForTests<V>(
    instance: SingleFlight<V>
): void {
    resetHandles.get(instance as SingleFlight<never>)?.();
}
