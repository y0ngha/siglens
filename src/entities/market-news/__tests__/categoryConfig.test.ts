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
    it('5개 카테고리 전부에 sentinel·endpoint·slug·koLabel·koDescription을 가진다', () => {
        const keys = Object.keys(CATEGORY_CONFIG);
        expect(keys).toHaveLength(5);
        for (const cfg of Object.values(CATEGORY_CONFIG)) {
            expect(cfg.sentinel.startsWith('__NEWS_')).toBe(true);
            expect(cfg.fmpEndpoint.length).toBeGreaterThan(0);
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
