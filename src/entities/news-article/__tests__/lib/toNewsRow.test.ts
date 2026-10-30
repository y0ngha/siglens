import { toNewsRow, type NewsDbRow } from '../../lib/toNewsRow';

const ROW: NewsDbRow = {
    id: 'abc123',
    symbol: 'AAPL',
    source: 'Reuters',
    url: 'https://example.com/1',
    publishedAt: new Date('2025-07-01T10:00:00.000Z'),
    titleEn: 'Apple earnings beat',
    titleKo: '애플 실적 상회',
    bodyKo: null,
    summaryKo: '긍정적 실적',
    sentiment: 'bullish',
    category: 'earnings',
    priceImpact: 'high',
    analyzedAt: new Date('2025-07-01T11:00:00.000Z'),
};

describe('toNewsRow', () => {
    it('발행 시각을 ISO 문자열로 바꾼다', () => {
        expect(toNewsRow(ROW).publishedAt).toBe('2025-07-01T10:00:00.000Z');
    });

    it('DB가 줘도 bodyEn은 항상 null로 둔다', () => {
        expect(toNewsRow({ ...ROW, bodyEn: 'raw body' }).bodyEn).toBeNull();
    });

    it('허용된 감성·분류·영향도 값은 그대로 통과시킨다', () => {
        const row = toNewsRow(ROW);

        expect(row.sentiment).toBe('bullish');
        expect(row.category).toBe('earnings');
        expect(row.priceImpact).toBe('high');
    });

    it('화이트리스트 밖 값은 null로 떨어뜨린다', () => {
        const row = toNewsRow({
            ...ROW,
            sentiment: 'euphoric',
            category: 'gossip',
            priceImpact: 'huge',
        });

        expect(row.sentiment).toBeNull();
        expect(row.category).toBeNull();
        expect(row.priceImpact).toBeNull();
    });

    it('분석 전 행(null 컬럼)은 null 그대로 유지한다', () => {
        const row = toNewsRow({
            ...ROW,
            titleKo: null,
            summaryKo: null,
            sentiment: null,
            category: null,
            priceImpact: null,
            analyzedAt: null,
        });

        expect(row.titleKo).toBeNull();
        expect(row.sentiment).toBeNull();
        expect(row.analyzedAt).toBeNull();
    });
});
