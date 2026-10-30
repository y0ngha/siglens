/**
 * Formatted values for the four options metric cards. Keeps the entity
 * formatters out of the `.tsx`; labels and tooltips stay in the component
 * because they need i18n and JSX.
 */
import type { OptionsExpirationMetrics } from '@y0ngha/siglens-core';
import {
    formatAtmIv,
    formatImpliedMove,
    formatMaxPain,
    formatPutCallRatio,
    METRIC_PLACEHOLDER,
} from '@/entities/options-chain/lib/optionsFormatters';

/** Identifier of a metric card. */
export type MetricCardKey =
    | 'maxPain'
    | 'putCallRatio'
    | 'atmIv'
    | 'impliedMove';

/**
 * Format every metric card value. When the OI snapshot is stale all four
 * collapse to the placeholder: Max Pain, ATM IV and implied move depend
 * directly on OI/IV, so computing them from stale quotes would present wrong
 * numbers (e.g. `$50`, `0.0%`) as if they were reliable.
 */
export function buildMetricCardValues(
    metrics: OptionsExpirationMetrics | null,
    oiStale: boolean
): Record<MetricCardKey, string> {
    if (oiStale) {
        return {
            maxPain: METRIC_PLACEHOLDER,
            putCallRatio: METRIC_PLACEHOLDER,
            atmIv: METRIC_PLACEHOLDER,
            impliedMove: METRIC_PLACEHOLDER,
        };
    }
    return {
        maxPain: formatMaxPain(metrics?.maxPain ?? null),
        putCallRatio: formatPutCallRatio(metrics?.putCallRatio ?? null),
        atmIv: formatAtmIv(metrics?.atmImpliedVolatility ?? null),
        impliedMove: formatImpliedMove(metrics?.impliedMovePercent ?? null),
    };
}
