import { CRYPTO_CATEGORIES } from '@/shared/config/crypto-categories';
import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';

describe('CRYPTO_CATEGORIES', () => {
    it('각 그룹은 최소 5개 종목을 가진다', () => {
        for (const category of CRYPTO_CATEGORIES) {
            expect(category.items.length).toBeGreaterThanOrEqual(5);
        }
    });

    it('모든 심볼은 검증된 POPULAR_CRYPTOS에 포함된다', () => {
        const valid = new Set<string>(POPULAR_CRYPTOS);
        for (const category of CRYPTO_CATEGORIES) {
            for (const item of category.items) {
                expect(valid.has(item.symbol)).toBe(true);
            }
        }
    });

    it('전체 심볼에 중복이 없다', () => {
        const symbols = CRYPTO_CATEGORIES.flatMap(c =>
            c.items.map(i => i.symbol)
        );
        expect(new Set(symbols).size).toBe(symbols.length);
    });

    it('모든 한글명이 비어있지 않다', () => {
        for (const category of CRYPTO_CATEGORIES) {
            for (const item of category.items) {
                expect(item.name.length).toBeGreaterThan(0);
            }
        }
    });

    it('major와 altcoin 그룹이 존재한다', () => {
        const ids = CRYPTO_CATEGORIES.map(c => c.id);
        expect(ids).toContain('major');
        expect(ids).toContain('altcoin');
    });
});
