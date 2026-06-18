import type { SubmitMarketNewsDigestResult } from '@y0ngha/siglens-core';

export interface SubmitMarketNewsDigestActionError {
    status: 'error';
    error: string;
}

/**
 * Action wrapper around core's SubmitMarketNewsDigestResult — adds an honest
 * 'error' variant for client-visible failures (e.g. DB errors) that must not
 * be silently collapsed to 'no_news'.
 */
export type SubmitMarketNewsDigestActionResult =
    | SubmitMarketNewsDigestResult
    | SubmitMarketNewsDigestActionError;
