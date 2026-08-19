import { describe, it, expect } from 'vitest';
import { TICKER_RE } from '@/shared/config/ticker';
import { CATEGORY_CONFIG, categoryFromSlug } from '../lib/categoryConfig';

describe('categoryFromSlug 함수는', () => {
    it('유효한 slug를 NewsFeedCategory로 매핑한다', () => {
        expect(categoryFromSlug('crypto')).toBe('crypto');
    });
    it('유효하지 않은 slug면 null을 반환한다', () => {
        expect(categoryFromSlug('__NEWS_CRYPTO__')).toBeNull();
        expect(categoryFromSlug('bogus')).toBeNull();
    });
});

describe('CATEGORY_CONFIG는', () => {
    it('6개 카테고리 전부에 sentinel·endpoint·slug·koLabel·koDescription을 가진다', () => {
        const keys = Object.keys(CATEGORY_CONFIG);
        expect(keys).toHaveLength(6);
        for (const cfg of Object.values(CATEGORY_CONFIG)) {
            expect(cfg.sentinel.startsWith('__NEWS_')).toBe(true);
            // 소스별로 식별자가 다르다: FMP는 엔드포인트 경로, 네이버는 검색어 목록.
            // 둘 다 비어 있으면 그 카테고리는 데이터를 가져올 방법이 없다.
            if (cfg.source === 'fmp') {
                expect(cfg.fmpEndpoint.length).toBeGreaterThan(0);
                expect(cfg.naverQueries).toHaveLength(0);
            } else {
                expect(cfg.fmpEndpoint).toBe('');
                expect(cfg.naverQueries.length).toBeGreaterThan(0);
            }
            expect(cfg.koLabel.length).toBeGreaterThan(0);
            expect(cfg.koDescription.length).toBeGreaterThan(0);
        }
    });
    it('sentinel은 VALID_TICKER_RE와 충돌하지 않는다(/[symbol] 누수 방지)', () => {
        for (const cfg of Object.values(CATEGORY_CONFIG)) {
            expect(TICKER_RE.test(cfg.sentinel)).toBe(false);
        }
    });
});
