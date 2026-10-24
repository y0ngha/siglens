import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getFmpDividendHistory, getYahooDividendData } = vi.hoisted(() => ({
    getFmpDividendHistory: vi.fn(),
    getYahooDividendData: vi.fn(),
}));
vi.mock('@/shared/api/fmp/dividendsClient', () => ({ getFmpDividendHistory }));
vi.mock('@/shared/api/yahoo/yahooDividendSource', () => ({
    getYahooDividendData,
}));

import {
    buildDividends,
    buildHistoryDividends,
    buildYahooDividends,
    buildYahooSummaryDividends,
    fetchDividendSource,
    withAnnualReported,
} from '@/app/api/ai/chat/tools/dividends';
import type { YahooDividendSummary } from '@/shared/api/yahoo/yahooDividendSource';

const TODAY = '2026-10-24';
const NOW = new Date('2026-10-24T15:00:00Z');
const TZ = 'America/New_York';

const row = (
    exDate: string,
    amount: number,
    payDate: string | null = null
) => ({
    exDate,
    amount,
    payDate,
});

describe('buildHistoryDividends', () => {
    it('직전 배당과 365일 트레일링 합·수익률을 계산한다', () => {
        const r = buildHistoryDividends(
            [
                row('2026-08-10', 0.27, '2026-08-13'),
                row('2026-05-11', 0.26),
                row('2026-02-09', 0.26),
                row('2025-11-10', 0.26),
                // 창 밖(365일 이전)
                row('2025-10-20', 0.25),
            ],
            200,
            'USD',
            NOW,
            TZ,
            'FMP dividends history'
        );
        expect(r).toEqual({
            latestExDate: '2026-08-10',
            latestAmount: 0.27,
            currency: 'USD',
            payDate: '2026-08-13',
            trailing12mAmount: 1.05,
            trailingYieldPct: 0.53,
            source: 'FMP dividends history',
        });
    });

    it('입력 순서와 무관하게 최신 배당락일을 고르고 미래 배당락일은 뺀다', () => {
        const r = buildHistoryDividends(
            [
                row('2026-05-11', 0.26),
                row('2026-11-10', 0.3),
                row('2026-08-10', 0.27),
            ],
            null,
            'USD',
            NOW,
            TZ,
            'FMP dividends history'
        );
        expect(r.latestExDate).toBe('2026-08-10');
        expect(r.trailing12mAmount).toBe(0.53);
        expect(r.trailingYieldPct).toBeNull();
    });

    it('이력이 비면 확정 무배당(0)이다', () => {
        expect(
            buildHistoryDividends(
                [],
                100,
                'USD',
                NOW,
                TZ,
                'FMP dividends history'
            )
        ).toEqual({
            latestExDate: null,
            latestAmount: null,
            currency: 'USD',
            payDate: null,
            trailing12mAmount: 0,
            trailingYieldPct: 0,
            source: 'FMP dividends history',
        });
    });

    it('창 안에 배당이 없으면 직전 배당은 남기고 트레일링은 0이다', () => {
        const r = buildHistoryDividends(
            [row('2024-01-10', 1)],
            100,
            'USD',
            NOW,
            TZ,
            'FMP dividends history'
        );
        expect(r.latestExDate).toBe('2024-01-10');
        expect(r.trailing12mAmount).toBe(0);
        expect(r.trailingYieldPct).toBe(0);
    });

    it('365일 경계: 정확히 365일 전 배당락일은 창 밖이다', () => {
        const r = buildHistoryDividends(
            [row('2025-10-24', 1)],
            100,
            'USD',
            NOW,
            TZ,
            'FMP dividends history'
        );
        expect(r.trailing12mAmount).toBe(0);
        const inside = buildHistoryDividends(
            [row('2025-10-25', 1)],
            100,
            'USD',
            NOW,
            TZ,
            'FMP dividends history'
        );
        expect(inside.trailing12mAmount).toBe(1);
    });
});

const summary = (
    over: Partial<YahooDividendSummary> = {}
): YahooDividendSummary => ({
    dividendRate: null,
    trailingAnnualDividendRate: null,
    dividendYield: null,
    trailingAnnualDividendYield: null,
    exDividendDate: null,
    lastDividendValue: null,
    lastDividendDate: null,
    ...over,
});

describe('buildYahooSummaryDividends', () => {
    it('트레일링 연 배당금과 현재가로 수익률을 계산하고 직전 1회 금액이 없으면 null이다', () => {
        const r = buildYahooSummaryDividends(
            summary({
                trailingAnnualDividendRate: 1444,
                exDividendDate: '2026-09-29',
            }),
            70000,
            'KRW',
            TODAY
        );
        expect(r).toEqual({
            latestExDate: '2026-09-29',
            latestAmount: null,
            currency: 'KRW',
            payDate: null,
            trailing12mAmount: 1444,
            trailingYieldPct: 2.06,
            source: 'Yahoo Finance summaryDetail',
        });
    });

    it('현재가가 없으면 트레일링 수익률(소수)을 퍼센트로 바꿔 쓴다', () => {
        const r = buildYahooSummaryDividends(
            summary({
                trailingAnnualDividendRate: 500,
                trailingAnnualDividendYield: 0.0182,
            }),
            null,
            'KRW',
            TODAY
        );
        expect(r?.trailing12mAmount).toBe(500);
        expect(r?.trailingYieldPct).toBe(1.82);
    });

    it('전방 dividendRate/dividendYield는 트레일링 필드에 쓰지 않는다', () => {
        const r = buildYahooSummaryDividends(
            summary({ dividendRate: 500, dividendYield: 0.0182 }),
            1000,
            'KRW',
            TODAY
        );
        expect(r).not.toBeNull();
        expect(r?.trailing12mAmount).toBeNull();
        expect(r?.trailingYieldPct).toBeNull();
    });

    it('미래 배당락일은 직전 배당락일로 보고하지 않는다', () => {
        const future = buildYahooSummaryDividends(
            summary({
                trailingAnnualDividendRate: 100,
                exDividendDate: '2026-12-29',
            }),
            1000,
            'KRW',
            TODAY
        );
        expect(future?.latestExDate).toBeNull();
        const fallback = buildYahooSummaryDividends(
            summary({
                trailingAnnualDividendRate: 100,
                exDividendDate: '2026-12-29',
                lastDividendDate: '2026-06-29',
            }),
            1000,
            'KRW',
            TODAY
        );
        expect(fallback?.latestExDate).toBe('2026-06-29');
    });

    it('trailingAnnualDividendRate가 명시적으로 0이면 확정 무배당이다', () => {
        const r = buildYahooSummaryDividends(
            summary({ trailingAnnualDividendRate: 0 }),
            1000,
            'KRW',
            TODAY
        );
        expect(r?.trailing12mAmount).toBe(0);
        expect(r?.trailingYieldPct).toBe(0);
        expect(r?.latestExDate).toBeNull();
    });

    it('배당 필드가 전부 비면 모름(null)이다', () => {
        expect(
            buildYahooSummaryDividends(summary(), 1000, 'KRW', TODAY)
        ).toBeNull();
    });

    it('직전 1회 금액·일자가 있으면 싣는다', () => {
        const r = buildYahooSummaryDividends(
            summary({ lastDividendValue: 361, lastDividendDate: '2026-06-29' }),
            null,
            'KRW',
            TODAY
        );
        expect(r?.latestAmount).toBe(361);
        expect(r?.latestExDate).toBe('2026-06-29');
        expect(r?.trailing12mAmount).toBeNull();
    });
});

describe('buildYahooDividends (history first)', () => {
    const ev = (exDate: string, amount: number) => ({ exDate, amount });

    it('LG유플러스형: 12개월 안의 두 번 지급을 합해 수익률을 낸다(한 번만 보지 않는다)', () => {
        const r = buildYahooDividends(
            {
                history: [
                    ev('2026-08-12', 270),
                    ev('2026-03-30', 410),
                    ev('2025-08-04', 250),
                    ev('2025-03-28', 400),
                ],
                summary: summary({ trailingAnnualDividendRate: 270 }),
            },
            14160,
            'KRW',
            new Date('2026-10-24T03:00:00Z'),
            'Asia/Seoul'
        );
        expect(r).toEqual({
            latestExDate: '2026-08-12',
            latestAmount: 270,
            currency: 'KRW',
            payDate: null,
            trailing12mAmount: 680,
            trailingYieldPct: 4.8,
            source: 'Yahoo Finance dividend history',
        });
    });

    it('미래 배당락일은 직전·합계에서 뺀다', () => {
        const r = buildYahooDividends(
            {
                history: [ev('2026-12-29', 380), ev('2026-06-29', 350)],
                summary: null,
            },
            9720,
            'KRW',
            new Date('2026-10-24T03:00:00Z'),
            'Asia/Seoul'
        );
        expect(r?.latestExDate).toBe('2026-06-29');
        expect(r?.trailing12mAmount).toBe(350);
    });

    it.each([
        ['이력 조회 실패(null)', null],
        ['이력 이벤트 없음([])', []],
    ])('%s이면 summaryDetail 규칙으로 내려간다', (_name, history) => {
        const r = buildYahooDividends(
            {
                history,
                summary: summary({ trailingAnnualDividendRate: 0 }),
            },
            1000,
            'KRW',
            NOW,
            'Asia/Seoul'
        );
        expect(r?.source).toBe('Yahoo Finance summaryDetail');
        expect(r?.trailing12mAmount).toBe(0);
    });

    it('이력도 요약도 없으면 모름(null)이다', () => {
        expect(
            buildYahooDividends(
                { history: null, summary: null },
                1000,
                'KRW',
                NOW,
                'Asia/Seoul'
            )
        ).toBeNull();
    });
});

describe('buildYahooDividends KST boundaries', () => {
    // 2026-10-24T20:00Z = 2026-10-25 05:00 KST, 같은 순간 UTC 날짜는 10-24.
    const KST_NOW = new Date('2026-10-24T20:00:00Z');
    const build = (exDate: string) =>
        buildYahooDividends(
            { history: [{ exDate, amount: 100 }], summary: null },
            1000,
            'KRW',
            KST_NOW,
            'Asia/Seoul'
        );

    it('365일 창은 KST 오늘 기준: 2025-10-25는 제외, 2025-10-26은 포함', () => {
        expect(build('2025-10-25')?.trailing12mAmount).toBe(0);
        expect(build('2025-10-26')?.trailing12mAmount).toBe(100);
    });

    it('KST 오늘(10-25) 배당락일은 과거로 센다(UTC였다면 미래)', () => {
        const r = build('2026-10-25');
        expect(r?.latestExDate).toBe('2026-10-25');
        expect(r?.trailing12mAmount).toBe(100);
    });

    it('KST 내일(10-26) 배당락일은 미래라 뺀다', () => {
        const r = build('2026-10-26');
        expect(r?.latestExDate).toBeNull();
        expect(r?.trailing12mAmount).toBe(0);
    });
});

describe('fetchDividendSource / buildDividends', () => {
    beforeEach(() => vi.clearAllMocks());

    it('미국은 FMP 이력을 읽고 buildDividends가 계산한다', async () => {
        getFmpDividendHistory.mockResolvedValue([
            row('2026-05-19', 0.6472, '2026-06-15'),
        ]);
        const source = await fetchDividendSource('FER', false);
        expect(getFmpDividendHistory).toHaveBeenCalledWith('FER');
        expect(getYahooDividendData).not.toHaveBeenCalled();
        const r = buildDividends(source, {
            price: 50,
            currency: 'USD',
            timeZone: TZ,
            now: NOW,
        });
        expect(r?.trailing12mAmount).toBe(0.6472);
        expect(r?.currency).toBe('USD');
    });

    it('한국은 yahoo 원자료를 읽고, 원자료가 없어 throw하면 로그 후 null이다', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        getYahooDividendData.mockRejectedValue(new Error('missing'));
        expect(await fetchDividendSource('005930.KS', true)).toBeNull();
        expect(spy).toHaveBeenCalledTimes(1);
        spy.mockRestore();
        expect(getFmpDividendHistory).not.toHaveBeenCalled();
        expect(
            buildDividends(null, { price: 1, currency: 'KRW', timeZone: TZ })
        ).toBeNull();
    });

    it('이력이 없어 요약으로 내려가도 시장 시간대(KST)의 오늘로 미래 배당락일을 거른다', async () => {
        getYahooDividendData.mockResolvedValue({
            history: null,
            summary: summary({
                trailingAnnualDividendRate: 100,
                exDividendDate: '2026-10-26',
            }),
        });
        const source = await fetchDividendSource('005930.KS', true);
        const r = buildDividends(source, {
            price: 1000,
            currency: 'KRW',
            timeZone: 'Asia/Seoul',
            now: NOW,
        });
        expect(r?.latestExDate).toBeNull();
    });

    it('공급자가 throw하면 로그 후 null(모름)이다', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        getFmpDividendHistory.mockRejectedValue(new Error('boom'));
        expect(await fetchDividendSource('AAPL', false)).toBeNull();
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });
});

describe('withAnnualReported', () => {
    const view = {
        latestExDate: '2025-12-29',
        latestAmount: 3000,
        currency: 'KRW',
        payDate: null,
        trailing12mAmount: 6000,
        trailingYieldPct: 3.17,
        source: 'Yahoo Finance dividend history',
    };
    const annual = { fiscalYear: 2025, dpsCommon: 6000, dartYieldPct: 4.1 };

    it('DPS를 현재가로 나눠 소수 둘째 자리까지 반올림하고 DART 보고값은 그대로 둔다', () => {
        expect(withAnnualReported(view, annual, 189400)).toEqual({
            ...view,
            annualReported: {
                fiscalYear: 2025,
                dpsCommon: 6000,
                dartYieldPct: 4.1,
                yieldOnLastClosePct: 3.17,
                source: 'DART',
            },
        });
    });

    it('기존 트레일링 필드는 바꾸지 않는다', () => {
        expect(withAnnualReported(view, annual, 100000)).toMatchObject(view);
    });

    it('현재가나 DPS가 없으면 현재가 기준 수익률만 null이다', () => {
        expect(
            withAnnualReported(view, annual, null)?.annualReported
        ).toMatchObject({ dpsCommon: 6000, yieldOnLastClosePct: null });
        expect(
            withAnnualReported(view, { ...annual, dpsCommon: null }, 100)
                ?.annualReported?.yieldOnLastClosePct
        ).toBeNull();
    });

    it('DART 값이 없으면 필드를 만들지 않고, 뷰가 없으면 null이다', () => {
        expect(withAnnualReported(view, null, 100)).toBe(view);
        expect(
            'annualReported' in (withAnnualReported(view, null, 1) ?? {})
        ).toBe(false);
        expect(withAnnualReported(null, annual, 100)).toBeNull();
    });
});
