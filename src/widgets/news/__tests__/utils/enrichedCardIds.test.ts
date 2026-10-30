import {
    collectEnrichedCardIds,
    hasNewEnrichedCard,
} from '@/widgets/news/utils/enrichedCardIds';
import type { NewsDisplayItem } from '@/shared/lib/types';

const card = (
    id: string,
    sentiment: string | null,
    priceImpact: string | null
) => ({ id, sentiment, priceImpact }) as unknown as NewsDisplayItem;

describe('collectEnrichedCardIds', () => {
    it('두 필드가 모두 채워진 카드의 id만 모은다', () => {
        const ids = collectEnrichedCardIds([
            card('a', 'bullish', 'high'),
            card('b', 'bullish', null),
            card('c', null, null),
        ]);
        expect([...ids]).toEqual(['a']);
    });
});

describe('hasNewEnrichedCard', () => {
    it('기준선에 없던 보강 카드가 있으면 참이다', () => {
        expect(
            hasNewEnrichedCard(new Set(['a']), [
                card('a', 'x', 'y'),
                card('b', 'x', 'y'),
            ])
        ).toBe(true);
    });

    it('개수가 같아도 id가 바뀌었다면 참이다', () => {
        expect(hasNewEnrichedCard(new Set(['a']), [card('b', 'x', 'y')])).toBe(
            true
        );
    });

    it('새 보강 카드가 없으면 거짓이다', () => {
        expect(
            hasNewEnrichedCard(new Set(['a', 'b']), [
                card('a', 'x', 'y'),
                card('c', null, null),
            ])
        ).toBe(false);
    });
});
