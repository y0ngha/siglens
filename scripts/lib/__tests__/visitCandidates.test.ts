import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    MAX_VISIT_CANDIDATES_PER_CLASS,
    classifyVisitSymbol,
    extractExistingKrTickers,
    selectVisitCandidates,
} from '../visitCandidates';

const CRYPTO = new Set(['BTCUSD', 'ETHUSD']);
const classify = (s: string) => classifyVisitSymbol(s, CRYPTO);

describe('classifyVisitSymbol', () => {
    it.each([
        ['005930.KS', 'kr'],
        ['058470.KQ', 'kr'],
        ['BTCUSD', 'crypto'],
        ['AAPL', 'us'],
        ['BRK.B', 'us'],
    ])('%s → %s', (symbol, expected) => {
        expect(classify(symbol)).toBe(expected);
    });
});

describe('selectVisitCandidates', () => {
    const tallies = [
        { symbol: 'NVDA', views: 20 },
        { symbol: 'BTCUSD', views: 15 },
        { symbol: '005930.KS', views: 12 },
        { symbol: 'AAPL', views: 10 },
        { symbol: 'PLTR', views: 3 },
    ];

    it('자산군이 맞고 기존 목록에 없는 것만, 조회수 순으로', () => {
        const result = selectVisitCandidates(
            tallies,
            'us',
            new Set(['AAPL']),
            classify
        );
        expect(result).toEqual([
            { symbol: 'NVDA', views: 20 },
            { symbol: 'PLTR', views: 3 },
        ]);
    });

    it('입력 순서와 무관하게 조회수 내림차순', () => {
        const result = selectVisitCandidates(
            [...tallies].reverse(),
            'us',
            new Set(),
            classify
        );
        expect(result.map(t => t.symbol)).toEqual(['NVDA', 'AAPL', 'PLTR']);
    });

    it(`자산군별 상한 ${MAX_VISIT_CANDIDATES_PER_CLASS}개`, () => {
        const many = Array.from({ length: 9 }, (_, i) => ({
            symbol: `T${String.fromCharCode(65 + i)}`,
            views: 100 - i,
        }));
        expect(
            selectVisitCandidates(many, 'us', new Set(), classify)
        ).toHaveLength(MAX_VISIT_CANDIDATES_PER_CLASS);
    });

    it('KR·크립토를 각각 분리해 고른다', () => {
        expect(
            selectVisitCandidates(tallies, 'kr', new Set(), classify)
        ).toEqual([{ symbol: '005930.KS', views: 12 }]);
        expect(
            selectVisitCandidates(tallies, 'crypto', new Set(), classify)
        ).toEqual([{ symbol: 'BTCUSD', views: 15 }]);
    });
});

describe('extractExistingKrTickers', () => {
    it('실제 popular-tickers.ts에서 KR 블록 심볼을 읽는다 (US 제외)', () => {
        const content = readFileSync(
            resolve(process.cwd(), 'src/shared/config/popular-tickers.ts'),
            'utf-8'
        );
        const kr = extractExistingKrTickers(content);
        expect(kr.has('005930.KS')).toBe(true);
        expect(kr.has('403870.KQ')).toBe(true);
        expect(kr.has('AAPL')).toBe(false);
    });

    it('POPULAR_TICKERS 선언 앞(카테고리 영역)의 KR 심볼은 세지 않는다', () => {
        const content = [
            "items: [{ symbol: '999990.KS', name: '카테고리만' }],",
            'export const POPULAR_TICKERS = [',
            "    '005930.KS', // 삼성전자",
            '] as const;',
        ].join('\n');
        expect([...extractExistingKrTickers(content)]).toEqual(['005930.KS']);
    });
});
