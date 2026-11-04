/**
 * `/backtesting` sitemap lastmod의 파싱 경계.
 *
 * 이 값이 `Invalid Date`가 되면 sitemap XML에 `Invalid Date`가 그대로 나가고,
 * 부정확한 lastmod는 Google이 그 sitemap의 lastmod 전체를 무시하게 만든다.
 * 그래서 파싱 실패는 예외가 아니라 `undefined`(빌더의 기존 폴백)여야 한다.
 */
import type { BacktestRunInfo } from '@y0ngha/siglens-core';
import { backtestingDataDate } from '../lib/backtestingDataDate';

function makeRun(periodEnd: string): { run: BacktestRunInfo } {
    return {
        run: {
            runId: 'test',
            periodStart: '2024-11-01',
            periodEnd,
            tickers: ['AAA'],
            model: 'm',
            coreVersion: '0',
            promptVersion: 'p',
            siglensVersion: '0',
            generatedAt: '',
            resultsUrl: '',
            releaseUrl: '',
        },
    };
}

describe('backtestingDataDate', () => {
    it('데이터 기간의 마지막 날을 UTC 자정으로 돌려준다', () => {
        expect(backtestingDataDate(makeRun('2026-11-02'))?.toISOString()).toBe(
            '2026-11-02T00:00:00.000Z'
        );
    });

    it('기간 끝이 비어 있으면 undefined (빌더가 폴백을 쓴다)', () => {
        expect(backtestingDataDate(makeRun(''))).toBeUndefined();
    });

    it('날짜로 파싱되지 않으면 undefined — Invalid Date를 sitemap에 내보내지 않는다', () => {
        expect(backtestingDataDate(makeRun('2026-13-45'))).toBeUndefined();
    });
});
