import type { WaitUntil } from '@y0ngha/siglens-core';

/** Runtime hooks for background tasks started by the ticker use-cases. */
export interface BackgroundTaskOptions {
    /**
     * Optional serverless lifetime extender for fire-and-forget work. On
     * Vercel, pass `waitUntil` from `@vercel/functions` so cache writes and
     * translation jobs can continue after the response is returned.
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

/** Register a background promise with the runtime when a waitUntil hook exists. */
export function fireAndForget(
    promise: Promise<unknown>,
    options?: BackgroundTaskOptions
): void {
    options?.waitUntil?.(promise);
}
