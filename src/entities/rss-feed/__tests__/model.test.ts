import { describe, expect, it } from 'vitest';
import {
    CATEGORY_CONFIG,
    NEWS_CATEGORY_SLUGS,
} from '@/entities/market-news/lib/categoryConfig';
import {
    economyHubPath,
    marketHubPath,
    newsHubPath,
    rssMarketSurface,
    rssNewsSurface,
} from '../model';

describe('허브 경로 helper', () => {
    it('시장·경제 허브는 내비 단일 소스의 지역 경로다', () => {
        expect(marketHubPath('us')).toBe('/market');
        expect(marketHubPath('kr')).toBe('/market/kr');
        expect(economyHubPath('us')).toBe('/economy');
        expect(economyHubPath('kr')).toBe('/economy/kr');
    });

    it('화면이 없는 지역은 null이다', () => {
        expect(marketHubPath('crypto')).toBeNull();
        expect(economyHubPath('crypto')).toBeNull();
    });

    it('뉴스 허브는 카테고리 slug 경로다 — 모든 카테고리', () => {
        for (const category of NEWS_CATEGORY_SLUGS) {
            expect(newsHubPath(category)).toBe(
                `/news/${CATEGORY_CONFIG[category].slug}`
            );
        }
    });
});

describe('표면 이름', () => {
    it('페이지 하나당 표면 하나다', () => {
        expect(rssMarketSurface('kr')).toBe('rss:market:kr');
        expect(rssNewsSurface('stock')).toBe('rss:news:stock');
    });
});
