import { buildNewsCardView } from '@/widgets/news/utils/newsCardView';
import type { NewsDisplayItem } from '@/shared/lib/types';

const ITEM = {
    id: '1',
    title: 'Title',
    url: 'https://example.com/1',
    publishedAt: '2025-01-01T00:00:00Z',
    source: 'Src',
    symbol: 'AAPL',
    sentiment: 'bullish',
    priceImpact: 'high',
} as unknown as NewsDisplayItem;

describe('buildNewsCardView', () => {
    it('보강이 끝난 고영향 카드는 강조 대상이다', () => {
        const view = buildNewsCardView(ITEM, 'ko');
        expect(view.pending).toBe(false);
        expect(view.isHighImpact).toBe(true);
    });

    it('sentiment만 있고 priceImpact가 null이면 엔티티 정의대로 대기 카드다', () => {
        const view = buildNewsCardView({ ...ITEM, priceImpact: null }, 'ko');
        expect(view.pending).toBe(true);
        expect(view.isHighImpact).toBe(false);
    });

    it('sentiment가 null이면 대기 카드다', () => {
        expect(
            buildNewsCardView({ ...ITEM, sentiment: null }, 'ko').pending
        ).toBe(true);
    });
});
