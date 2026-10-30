import { hasPendingCard } from '@/entities/news-article/lib/cardPollDecision';
import { isMarketNewsCardPending } from '@/widgets/market-news/utils/marketNewsCardPending';

type Sentiment = 'bullish' | null;
type Impact = 'high' | null;

const CASES: ReadonlyArray<readonly [Sentiment, Impact, boolean]> = [
    ['bullish', 'high', false],
    [null, 'high', true],
    ['bullish', null, true],
    [null, null, true],
];

describe('isMarketNewsCardPending', () => {
    it.each(CASES)(
        'sentiment=%s priceImpact=%s → %s',
        (sentiment, priceImpact, expected) => {
            expect(isMarketNewsCardPending({ sentiment, priceImpact })).toBe(
                expected
            );
        }
    );

    it.each(CASES)(
        '엔티티 hasPendingCard의 카드 한 장 판정과 같다 (%s, %s)',
        (sentiment, priceImpact) => {
            const card = { sentiment, priceImpact };
            expect(isMarketNewsCardPending(card)).toBe(hasPendingCard([card]));
        }
    );
});
