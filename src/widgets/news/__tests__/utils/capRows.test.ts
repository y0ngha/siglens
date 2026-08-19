/**
 * Unit tests for `capRows` — the client-side row cap that keeps the polling
 * result in sync with the server section's serialization limit.
 */
import { capRows } from '@/widgets/news/utils/capRows';
import { NEWS_ROW_SERIALIZATION_LIMIT } from '@/widgets/news/constants';
import type { NewsDisplayItem } from '@/shared/lib/types';

function makeItems(count: number): NewsDisplayItem[] {
    return Array.from(
        { length: count },
        (_, i) => ({ id: `${i}` }) as NewsDisplayItem
    );
}

describe('news capRows', () => {
    it('leaves a list at or under the limit untouched (same reference)', () => {
        const items = makeItems(NEWS_ROW_SERIALIZATION_LIMIT);
        expect(capRows(items)).toBe(items);
    });

    it('truncates a list over the limit to the first N items', () => {
        const items = makeItems(NEWS_ROW_SERIALIZATION_LIMIT + 10);
        const result = capRows(items);
        expect(result).toHaveLength(NEWS_ROW_SERIALIZATION_LIMIT);
        expect(result).toEqual(items.slice(0, NEWS_ROW_SERIALIZATION_LIMIT));
    });
});
