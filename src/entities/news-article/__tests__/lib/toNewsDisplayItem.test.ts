import { describe, it, expect } from 'vitest';
import { toNewsDisplayItem } from '../../lib/toNewsDisplayItem';
import type { NewsRow } from '../../api';

const ROW: NewsRow = {
    id: 'news-1',
    symbol: 'AAPL',
    source: 'Reuters',
    url: 'https://example.com/1',
    publishedAt: '2026-05-25T10:00:00.000Z',
    titleEn: 'Apple beats earnings',
    bodyEn: 'A very long English article body that must never reach the client.',
    titleKo: '애플 실적 상회',
    bodyKo: '한국어 본문',
    summaryKo: '요약',
    sentiment: 'bullish',
    category: 'earnings',
    priceImpact: 'high',
    analyzedAt: new Date('2026-05-25T11:00:00.000Z'),
};

describe('toNewsDisplayItem', () => {
    /**
     * `NewsRow`는 `NewsDisplayItem`의 상위 집합이라 그대로 넘겨도 타입 검사를
     * 통과한다 — 그래서 클라이언트 경계에서 걸러지지 않으면 `bodyEn`이 RSC
     * 페이로드에 실려 12시간 ISR 캐시에 굳는다(감사: 비용 라운드 14).
     */
    it('DB 내부 필드를 떨어뜨린다', () => {
        const item = toNewsDisplayItem(ROW);

        expect(item).not.toHaveProperty('bodyEn');
        expect(item).not.toHaveProperty('symbol');
        expect(item).not.toHaveProperty('analyzedAt');
    });

    it('표시 필드는 그대로 옮긴다', () => {
        expect(toNewsDisplayItem(ROW)).toEqual({
            id: 'news-1',
            publishedAt: '2026-05-25T10:00:00.000Z',
            titleEn: 'Apple beats earnings',
            titleKo: '애플 실적 상회',
            sentiment: 'bullish',
            category: 'earnings',
            bodyKo: '한국어 본문',
            summaryKo: '요약',
            priceImpact: 'high',
            url: 'https://example.com/1',
            source: 'Reuters',
        });
    });
});
