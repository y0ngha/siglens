import type { EnrichedNewsItem } from '@y0ngha/siglens-core';
import type { NewsRow } from '@/infrastructure/db/newsRepository';

/**
 * Type predicate: narrows a `NewsRow` to `EnrichedNewsItem`.
 *
 * A row is considered fully enriched when it has a translated title (`titleKo`),
 * a summary (`summaryKo`), a non-null sentiment, and a non-null category — the
 * four fields written by the per-card LLM analysis step.
 *
 * @internal
 */
export function isEnrichedRow(row: NewsRow): row is NewsRow & EnrichedNewsItem {
    return (
        row.titleKo !== null &&
        row.summaryKo !== null &&
        row.sentiment !== null &&
        row.category !== null
    );
}
