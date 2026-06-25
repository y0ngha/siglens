import type { WaitUntil } from '@y0ngha/siglens-core';

/** Runtime hooks for background tasks started by the ticker use-cases. */
export interface BackgroundTaskOptions {
    /**
     * Optional graceful-drain hook injected by the runtime. A future AWS
     * integration may supply a `waitUntil` implementation here so the runtime
     * can keep the process alive until background work (cache writes, translation
     * jobs) completes before shutdown. When absent, `fireAndForget` owns the
     * floating promise with a no-op catch-net.
     */
    waitUntil?: WaitUntil;
}

/** Subset of an FMP search result needed when persisting a translation. */
export interface AssetInfoMatch {
    symbol: string;
    name: string;
    exchange: string;
    exchangeFullName: string;
}

/**
 * Fire a background promise without awaiting it. If the caller supplies a
 * runtime `waitUntil` hook (e.g. a future AWS graceful-drain adapter), the
 * promise is handed off there so the runtime can track it. Otherwise the
 * promise floats with a no-op catch-net — errors are swallowed because the
 * caller-side `.catch(console.warn)` already handles logging before this point.
 */
export function fireAndForget(
    promise: Promise<unknown>,
    options?: BackgroundTaskOptions
): void {
    if (options?.waitUntil) {
        options.waitUntil(promise);
        return;
    }
    void promise.catch(() => {});
}
