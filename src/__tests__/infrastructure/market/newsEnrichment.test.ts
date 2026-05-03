import {
    isEnrichedRow,
    toEnrichedNewsItem,
    type EnrichedNewsRow,
} from '@/infrastructure/market/newsEnrichment';
import type { NewsRow } from '@/infrastructure/db/newsRepository';

const baseRow: NewsRow = {
    id: 'id-1',
    symbol: 'AAPL',
    source: 'reuters.com',
    url: 'https://example.com/a',
    publishedAt: '2026-05-01T12:00:00Z',
    titleEn: 'Title',
    bodyEn: 'Body',
    titleKo: '제목',
    bodyKo: '본문',
    summaryKo: '요약',
    sentiment: 'bullish',
    category: 'earnings',
    analyzedAt: new Date('2026-05-01T12:30:00Z'),
};

describe('isEnrichedRow 타입 가드는', () => {
    it('네 필드가 모두 non-null이면 true를 반환한다', () => {
        expect(isEnrichedRow(baseRow)).toBe(true);
    });

    it('titleKo가 null이면 false를 반환한다', () => {
        expect(isEnrichedRow({ ...baseRow, titleKo: null })).toBe(false);
    });

    it('summaryKo가 null이면 false를 반환한다', () => {
        expect(isEnrichedRow({ ...baseRow, summaryKo: null })).toBe(false);
    });

    it('sentiment가 null이면 false를 반환한다', () => {
        expect(isEnrichedRow({ ...baseRow, sentiment: null })).toBe(false);
    });

    it('category가 null이면 false를 반환한다', () => {
        expect(isEnrichedRow({ ...baseRow, category: null })).toBe(false);
    });

    it('bodyKo가 null이어도 다른 네 필드가 채워져 있으면 true를 반환한다', () => {
        expect(isEnrichedRow({ ...baseRow, bodyKo: null })).toBe(true);
    });
});

describe('toEnrichedNewsItem 매퍼는', () => {
    const enriched: EnrichedNewsRow = {
        ...baseRow,
        titleKo: '제목',
        summaryKo: '요약',
        sentiment: 'bullish',
        category: 'earnings',
    };

    it('NewsRow의 식별 필드를 EnrichedNewsItem의 같은 키로 옮긴다', () => {
        const item = toEnrichedNewsItem(enriched);

        expect(item.id).toBe('id-1');
        expect(item.symbol).toBe('AAPL');
        expect(item.source).toBe('reuters.com');
        expect(item.url).toBe('https://example.com/a');
        expect(item.publishedAt).toBe('2026-05-01T12:00:00Z');
        expect(item.titleEn).toBe('Title');
        expect(item.bodyEn).toBe('Body');
    });

    it('번역/감정/카테고리 필드를 card 객체로 묶는다', () => {
        const item = toEnrichedNewsItem(enriched);

        expect(item.card).toEqual({
            titleKo: '제목',
            bodyKo: '본문',
            summaryKo: '요약',
            sentiment: 'bullish',
            category: 'earnings',
        });
    });

    it('bodyKo가 null이어도 card.bodyKo로 그대로 전달한다', () => {
        const item = toEnrichedNewsItem({ ...enriched, bodyKo: null });

        expect(item.card.bodyKo).toBeNull();
    });
});
