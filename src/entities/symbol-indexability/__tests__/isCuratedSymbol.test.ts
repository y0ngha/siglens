import { describe, expect, it } from 'vitest';
import { isCuratedSymbol } from '../lib/isCuratedSymbol';
import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';
import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';

describe('isCuratedSymbol', () => {
    it('인기 종목은 대소문자와 무관하게 큐레이션이다', () => {
        expect(isCuratedSymbol('AAPL')).toBe(true);
        expect(isCuratedSymbol('aapl')).toBe(true);
    });

    it('인기 크립토도 큐레이션이다', () => {
        expect(isCuratedSymbol('BTCUSD')).toBe(true);
    });

    it('목록 밖 롱테일은 큐레이션이 아니다', () => {
        expect(isCuratedSymbol('PCLOF')).toBe(false);
        expect(isCuratedSymbol('')).toBe(false);
    });

    it('두 목록의 모든 항목을 받아들인다', () => {
        for (const symbol of [...POPULAR_TICKERS, ...POPULAR_CRYPTOS]) {
            expect(isCuratedSymbol(symbol)).toBe(true);
        }
    });
});
