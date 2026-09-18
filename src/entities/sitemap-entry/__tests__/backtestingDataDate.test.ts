/**
 * `/backtesting` sitemap lastmod의 파싱 경계.
 *
 * 이 값이 `Invalid Date`가 되면 sitemap XML에 `Invalid Date`가 그대로 나가고,
 * 부정확한 lastmod는 Google이 그 sitemap의 lastmod 전체를 무시하게 만든다.
 * 그래서 파싱 실패는 예외가 아니라 `undefined`(빌더의 기존 폴백)여야 한다.
 */
import type { BacktestCase } from '@y0ngha/siglens-core';
import { backtestingDataDate } from '../lib/backtestingDataDate';

function makeCase(entryDate: string): BacktestCase {
    return {
        ticker: 'TEST',
        entryDate,
        entryPrice: 100,
        exitDate: '2025-01-05',
        exitPrice: 101,
        holdingDays: 4,
        returnPct: 1,
        signalType: 'buy',
        result: 'win',
        exitReason: 'time',
        aiResult: 'neutral',
        aiTrendHit: false,
        aiAnalysis: {
            summary: '',
            tags: [],
            entryRecommendation: 'wait',
            bullishTargets: [],
        },
    };
}

describe('backtestingDataDate', () => {
    it('마지막 진입일을 UTC 자정으로 돌려준다', () => {
        const result = backtestingDataDate([
            makeCase('2024-11-26'),
            makeCase('2026-03-31'),
            makeCase('2025-07-01'),
        ]);

        expect(result?.toISOString()).toBe('2026-03-31T00:00:00.000Z');
    });

    it('케이스가 없으면 undefined (빌더가 폴백을 쓴다)', () => {
        expect(backtestingDataDate([])).toBeUndefined();
    });

    it('진입일이 날짜로 파싱되지 않으면 undefined — Invalid Date를 sitemap에 내보내지 않는다', () => {
        expect(backtestingDataDate([makeCase('2026-13-45')])).toBeUndefined();
    });
});
