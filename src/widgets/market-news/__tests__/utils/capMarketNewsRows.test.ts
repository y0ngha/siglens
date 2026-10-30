import { NEWS_ROW_SERIALIZATION_LIMIT } from '@/shared/config/newsSerialization';
import { capMarketNewsRows } from '@/widgets/market-news/utils/capMarketNewsRows';

describe('capMarketNewsRows', () => {
    it('상한 이하면 그대로 돌려준다', () => {
        const rows = [1, 2, 3];
        expect(capMarketNewsRows(rows)).toBe(rows);
    });

    it('상한을 넘으면 앞(최신)부터 상한까지만 남긴다', () => {
        const rows = Array.from(
            { length: NEWS_ROW_SERIALIZATION_LIMIT + 5 },
            (_, i) => i
        );
        const capped = capMarketNewsRows(rows);
        expect(capped).toHaveLength(NEWS_ROW_SERIALIZATION_LIMIT);
        expect(capped[0]).toBe(0);
    });
});
