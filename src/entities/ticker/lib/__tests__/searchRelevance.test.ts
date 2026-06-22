import { describe, it, expect } from 'vitest';
import {
    scoreSearchRelevance,
    rankByRelevance,
    isPopularSymbol,
    EXACT_MATCH_SCORE,
    PREFIX_MATCH_SCORE,
    SUBSTRING_MATCH_SCORE,
    FALLBACK_SCORE,
    POPULAR_BONUS,
} from '../searchRelevance';
import type { TickerSearchResult } from '@/shared/lib/types';

function makeResult(
    symbol: string,
    name: string,
    koreanName?: string
): TickerSearchResult {
    return {
        symbol,
        name,
        koreanName,
        exchange: 'TEST',
        exchangeFullName: 'Test Exchange',
    };
}

describe('scoreSearchRelevance', () => {
    it('exact koreanName match scores 100', () => {
        const result = makeResult('BTCUSD', 'Bitcoin USD', '비트코인');
        expect(scoreSearchRelevance(result, '비트코인', false)).toBe(
            EXACT_MATCH_SCORE
        );
    });

    it('exact symbol match scores 100', () => {
        const result = makeResult('BTCUSD', 'Bitcoin USD');
        expect(scoreSearchRelevance(result, 'BTCUSD', false)).toBe(
            EXACT_MATCH_SCORE
        );
    });

    it('exact name match scores 100', () => {
        const result = makeResult('BTC', 'bitcoin usd');
        expect(scoreSearchRelevance(result, 'bitcoin usd', false)).toBe(
            EXACT_MATCH_SCORE
        );
    });

    it('prefix match scores 70', () => {
        const result = makeResult('BTCUSD', 'Bitcoin USD', '비트코인');
        expect(scoreSearchRelevance(result, '비트코', false)).toBe(
            PREFIX_MATCH_SCORE
        );
    });

    it('substring match scores 40', () => {
        const result = makeResult('BTCUSD', 'Bitcoin USD', '비트코인');
        expect(scoreSearchRelevance(result, '코인', false)).toBe(
            SUBSTRING_MATCH_SCORE
        );
    });

    it('no match scores 10 (base fallback)', () => {
        const result = makeResult('XYZUSD', 'XYZ Coin', 'X코인');
        expect(scoreSearchRelevance(result, 'bitcoin', false)).toBe(
            FALLBACK_SCORE
        );
    });

    it('popular bonus adds 15 on top of base', () => {
        const result = makeResult('BTCUSD', 'Bitcoin USD', '비트코인');
        expect(scoreSearchRelevance(result, '비트코인', true)).toBe(
            EXACT_MATCH_SCORE + POPULAR_BONUS
        );
    });

    it('popular bonus on prefix match = 70 + 15 = 85', () => {
        const result = makeResult('BTCUSD', 'Bitcoin USD', '비트코인');
        expect(scoreSearchRelevance(result, '비트코', true)).toBe(
            PREFIX_MATCH_SCORE + POPULAR_BONUS
        );
    });

    it('popular bonus on no-match = 10 + 15 = 25', () => {
        const result = makeResult('BTCUSD', 'Bitcoin USD');
        expect(scoreSearchRelevance(result, 'xyz', true)).toBe(
            FALLBACK_SCORE + POPULAR_BONUS
        );
    });

    it('score is case-insensitive', () => {
        const result = makeResult('AAPL', 'Apple Inc.');
        expect(scoreSearchRelevance(result, 'apple inc.', false)).toBe(
            EXACT_MATCH_SCORE
        );
        expect(scoreSearchRelevance(result, 'AAPL', false)).toBe(
            EXACT_MATCH_SCORE
        );
    });

    it('missing koreanName field is skipped safely', () => {
        const result = makeResult('AAPL', 'Apple Inc.');
        // No koreanName — should not throw and still score based on name/symbol.
        expect(scoreSearchRelevance(result, 'apple', false)).toBe(
            PREFIX_MATCH_SCORE
        );
    });
});

describe('rankByRelevance', () => {
    it('exact match ranks first, then prefix, then substring', () => {
        // query '비트': field '비트코인' startsWith '비트' → prefix → 70
        //               field '비트' === '비트' → exact → 100
        //               field '가나비트다라' includes '비트' → substring → 40
        const exactResult = makeResult('BITUSD', 'Bit Coin', '비트'); // exact → 100
        const prefixResult = makeResult('BTCUSD', 'Bitcoin USD', '비트코인'); // prefix → 70
        const subResult = makeResult('COINX', 'Coin X', '가나비트다라'); // substring → 40

        // Input order: prefix, substring, exact — so stable sort must reorder by score.
        const results = [prefixResult, subResult, exactResult];
        const ranked = rankByRelevance(results, '비트');
        expect(ranked[0].symbol).toBe('BITUSD'); // exact → 100
        expect(ranked[1].symbol).toBe('BTCUSD'); // prefix → 70
        expect(ranked[2].symbol).toBe('COINX'); // substring → 40
    });

    it('popular exact match beats non-popular exact match', () => {
        // BTCUSD is in POPULAR_CRYPTOS → score 100+15=115
        // VIDTUSD is not popular → score 100
        const results: TickerSearchResult[] = [
            makeResult('VIDTUSD', 'VIDT Coin', '비트코인'), // not popular, exact
            makeResult('BTCUSD', 'Bitcoin USD', '비트코인'), // popular, exact
        ];
        const ranked = rankByRelevance(results, '비트코인');
        expect(ranked[0].symbol).toBe('BTCUSD');
        expect(ranked[1].symbol).toBe('VIDTUSD');
    });

    it('stable sort preserves input order for equal-score results', () => {
        const results: TickerSearchResult[] = [
            makeResult('AAA', 'Alpha', '알파'),
            makeResult('BBB', 'Beta', '베타'),
            makeResult('CCC', 'Gamma', '감마'),
        ];
        // query 'xyz' matches none → all score 10, order preserved
        const ranked = rankByRelevance(results, 'xyz');
        expect(ranked.map(r => r.symbol)).toEqual(['AAA', 'BBB', 'CCC']);
    });

    it('does not slice — returns full array', () => {
        const results = Array.from({ length: 15 }, (_, i) =>
            makeResult(`SYM${i}`, `Symbol ${i}`)
        );
        expect(rankByRelevance(results, 'sym')).toHaveLength(15);
    });
});

describe('isPopularSymbol', () => {
    it('BTCUSD is popular (in POPULAR_CRYPTOS)', () => {
        expect(isPopularSymbol('BTCUSD')).toBe(true);
    });

    it('AAPL is popular (in POPULAR_TICKERS)', () => {
        expect(isPopularSymbol('AAPL')).toBe(true);
    });

    it('VIDTUSD is not popular', () => {
        expect(isPopularSymbol('VIDTUSD')).toBe(false);
    });
});
