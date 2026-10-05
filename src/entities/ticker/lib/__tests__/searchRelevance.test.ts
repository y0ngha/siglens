import { describe, it, expect } from 'vitest';
import {
    scoreSearchRelevance,
    matchSearchRelevance,
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

    it('empty query scores FALLBACK_SCORE (no field is a meaningful match)', () => {
        expect(
            scoreSearchRelevance(makeResult('AAPL', 'Apple Inc.'), '', false)
        ).toBe(FALLBACK_SCORE);
    });

    it('popular bonus adds 15 on top of base', () => {
        const result = makeResult('BTCUSD', 'Bitcoin USD', '비트코인');
        expect(scoreSearchRelevance(result, '비트코인', true)).toBe(
            EXACT_MATCH_SCORE + POPULAR_BONUS
        );
    });

    it('popular bonus on prefix match = PREFIX_MATCH_SCORE + POPULAR_BONUS', () => {
        const result = makeResult('BTCUSD', 'Bitcoin USD', '비트코인');
        expect(scoreSearchRelevance(result, '비트코', true)).toBe(
            PREFIX_MATCH_SCORE + POPULAR_BONUS
        );
    });

    it('popular bonus on no-match = FALLBACK_SCORE + POPULAR_BONUS', () => {
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

    it('empty/whitespace query scores FALLBACK_SCORE (guarded edge case)', () => {
        // After .trim() the query is '', which fieldScore guards (returns 0 for every
        // field) so the base never rises above FALLBACK_SCORE. Without the guard,
        // ''.startsWith('') would be true for every field and score everything as PREFIX.
        // The real caller (searchTicker) returns early on a blank query and never reaches
        // here; this test pins the guarded behavior of the pure function.
        const result = makeResult('AAPL', 'Apple Inc.', '애플');
        expect(scoreSearchRelevance(result, '', false)).toBe(FALLBACK_SCORE);
        expect(scoreSearchRelevance(result, '   ', false)).toBe(FALLBACK_SCORE);
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
        // query '비트': field '비트코인' startsWith '비트' → prefix → PREFIX_MATCH_SCORE
        //               field '비트' === '비트' → exact → EXACT_MATCH_SCORE
        //               field '가나비트다라' includes '비트' → substring → SUBSTRING_MATCH_SCORE
        const exactResult = makeResult('BITUSD', 'Bit Coin', '비트'); // exact → EXACT_MATCH_SCORE
        const prefixResult = makeResult('BTCUSD', 'Bitcoin USD', '비트코인'); // prefix → PREFIX_MATCH_SCORE
        const subResult = makeResult('COINX', 'Coin X', '가나비트다라'); // substring → SUBSTRING_MATCH_SCORE

        // Input order: prefix, substring, exact — so stable sort must reorder by score.
        const results = [prefixResult, subResult, exactResult];
        const ranked = rankByRelevance(results, '비트');
        expect(ranked[0].symbol).toBe('BITUSD'); // exact → EXACT_MATCH_SCORE
        expect(ranked[1].symbol).toBe('BTCUSD'); // prefix → PREFIX_MATCH_SCORE
        expect(ranked[2].symbol).toBe('COINX'); // substring → SUBSTRING_MATCH_SCORE
    });

    it('popular exact match beats non-popular exact match', () => {
        // BTCUSD is in POPULAR_CRYPTOS → EXACT_MATCH_SCORE + POPULAR_BONUS
        // VIDTUSD is not popular → EXACT_MATCH_SCORE only
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
        // query 'xyz' matches none → all score FALLBACK_SCORE, order preserved
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

describe('matchSearchRelevance', () => {
    it('score는 scoreSearchRelevance와 같다', () => {
        const r = makeResult('BTCUSD', 'Bitcoin USD', '비트코인');
        expect(matchSearchRelevance(r, '비트', true).score).toBe(
            scoreSearchRelevance(r, '비트', true)
        );
    });

    it('matchLength는 최고 점수를 낸 필드의 길이다', () => {
        const r = makeResult('BTCUSD', 'Bitcoin USD', '비트코인');
        expect(matchSearchRelevance(r, '비트', false).matchLength).toBe(
            '비트코인'.length
        );
        // name에서만 부분 일치 → name 길이
        expect(matchSearchRelevance(r, 'usd', false).matchLength).toBe(
            'BTCUSD'.length
        );
    });

    it('여러 필드가 같은 점수면 더 짧은 필드의 길이를 쓴다', () => {
        // symbol 'SAM'과 name 'Samsung Electronics' 둘 다 접두 일치(70)
        const r = makeResult('SAM', 'Samsung Electronics');
        expect(matchSearchRelevance(r, 'sam', false).matchLength).toBe(3);
    });

    it('일치한 필드가 없으면(폴백) 가장 나쁜 길이로 동률에서 뒤로 간다', () => {
        const r = makeResult('AAA', 'Alpha', '알파');
        expect(matchSearchRelevance(r, 'xyz', false).matchLength).toBe(
            Number.MAX_SAFE_INTEGER
        );
    });
});

describe('rankByRelevance — 동점 처리', () => {
    /**
     * `삼성`은 접두 일치(70)가 한꺼번에 쏟아지는 질의다. 예전에는 점수가 같으면 DB 순서를
     * 그대로 써서, 가장 알아볼 만한 `삼성전자`가 `삼성바이오로직스` 뒤에 올 수 있었다.
     * 픽스처의 DB 순서는 일부러 기대 순서의 반대다.
     */
    it('삼성: 같은 점수면 짧은 이름이 먼저, 그다음 인기 순위 (삼성전자 first)', () => {
        const results = [
            makeResult('207940.KS', 'Samsung Biologics', '삼성바이오로직스'),
            makeResult('028260.KS', 'Samsung C&T', '삼성물산'),
            makeResult('005930.KS', 'Samsung Electronics', '삼성전자'),
        ];
        const ranked = rankByRelevance(results, '삼성');
        // 셋 다 인기(+15) 접두(70) = 85. 삼성전자·삼성물산은 4자, 바이오로직스는 8자.
        // 4자끼리는 인기 순위: 005930.KS가 028260.KS보다 앞선다.
        expect(ranked.map(r => r.symbol)).toEqual([
            '005930.KS',
            '028260.KS',
            '207940.KS',
        ]);
    });

    it('비인기 종목끼리도 짧은 이름이 먼저다 (matchLength만으로 갈린다)', () => {
        const results = [
            makeResult('TST3.KS', 'Long', '삼성에스디에스'),
            makeResult('TST2.KS', 'Mid', '삼성SDI'),
            makeResult('TST1.KS', 'Short', '삼성증권'),
        ];
        const ranked = rankByRelevance(results, '삼성');
        expect(ranked.map(r => r.symbol)).toEqual([
            'TST1.KS',
            'TST2.KS',
            'TST3.KS',
        ]);
    });

    it('길이가 같으면 인기 목록의 앞선 종목이 먼저다 (POPULAR_TICKERS 순서)', () => {
        // 둘 다 4자, 둘 다 인기(85). 028260.KS가 입력에서 앞서지만 005930.KS가 목록에서 앞선다.
        const ranked = rankByRelevance(
            [
                makeResult('028260.KS', 'Samsung C&T', '삼성물산'),
                makeResult('005930.KS', 'Samsung Electronics', '삼성전자'),
            ],
            '삼성'
        );
        expect(ranked.map(r => r.symbol)).toEqual(['005930.KS', '028260.KS']);
    });

    it('인기 종목은 같은 길이의 비인기 종목보다 먼저다 (점수 +15가 우선)', () => {
        const ranked = rankByRelevance(
            [
                makeResult('TST1.KS', 'X', '삼성증권'),
                makeResult('005930.KS', 'Samsung Electronics', '삼성전자'),
            ],
            '삼성'
        );
        expect(ranked[0].symbol).toBe('005930.KS');
    });

    it('길이·인기까지 같으면 입력 순서를 유지한다', () => {
        const ranked = rankByRelevance(
            [
                makeResult('TST2.KS', 'B', '삼성뭐'),
                makeResult('TST1.KS', 'A', '삼성가'),
                makeResult('TST3.KS', 'C', '삼성나'),
            ],
            '삼성'
        );
        expect(ranked.map(r => r.symbol)).toEqual([
            'TST2.KS',
            'TST1.KS',
            'TST3.KS',
        ]);
    });

    it('정확 일치는 접두 일치보다 항상 앞선다 (점수가 길이보다 우선)', () => {
        const ranked = rankByRelevance(
            [
                makeResult('TST3.KS', 'C', '삼성전자우'),
                makeResult('TST2.KS', 'B', '삼성전자'),
            ],
            '삼성전자'
        );
        expect(ranked.map(r => r.symbol)).toEqual(['TST2.KS', 'TST3.KS']);

        // 정확 일치가 입력에서 뒤에 있어도, 길이가 더 긴 접두 일치가 앞서지 못한다.
        const longerExact = rankByRelevance(
            [
                makeResult('TST1.KS', 'A', '삼성전'),
                makeResult('TST2.KS', 'B', '삼성전자우선주'),
                makeResult('TST3.KS', 'C', '삼성전자우선'),
            ],
            '삼성전자우선'
        );
        // '삼성전자우선'은 TST3에서 정확 일치(100), TST2는 접두(70), TST1은 폴백(10).
        expect(longerExact.map(r => r.symbol)).toEqual([
            'TST3.KS',
            'TST2.KS',
            'TST1.KS',
        ]);
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
