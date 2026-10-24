import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getFmpDividendHistory, getYahooDividendSummary } = vi.hoisted(() => ({
    getFmpDividendHistory: vi.fn(),
    getYahooDividendSummary: vi.fn(),
}));
vi.mock('@/shared/api/fmp/dividendsClient', () => ({ getFmpDividendHistory }));
vi.mock('@/shared/api/yahoo/yahooDividendSource', () => ({
    getYahooDividendSummary,
}));

import {
    buildDividends,
    buildFmpDividends,
    buildYahooDividends,
    fetchDividendSource,
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

describe('buildFmpDividends', () => {
    it('직전 배당과 365일 트레일링 합·수익률을 계산한다', () => {
        const r = buildFmpDividends(
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
            TZ
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
        const r = buildFmpDividends(
            [
                row('2026-05-11', 0.26),
                row('2026-11-10', 0.3),
                row('2026-08-10', 0.27),
            ],
            null,
            'USD',
            NOW,
            TZ
        );
        expect(r.latestExDate).toBe('2026-08-10');
        expect(r.trailing12mAmount).toBe(0.53);
        expect(r.trailingYieldPct).toBeNull();
    });

    it('이력이 비면 확정 무배당(0)이다', () => {
        expect(buildFmpDividends([], 100, 'USD', NOW, TZ)).toEqual({
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
        const r = buildFmpDividends(
            [row('2024-01-10', 1)],
            100,
            'USD',
            NOW,
            TZ
        );
        expect(r.latestExDate).toBe('2024-01-10');
        expect(r.trailing12mAmount).toBe(0);
        expect(r.trailingYieldPct).toBe(0);
    });

    it('365일 경계: 정확히 365일 전 배당락일은 창 밖이다', () => {
        const r = buildFmpDividends(
            [row('2025-10-24', 1)],
            100,
            'USD',
            NOW,
            TZ
        );
        expect(r.trailing12mAmount).toBe(0);
        const inside = buildFmpDividends(
            [row('2025-10-25', 1)],
            100,
            'USD',
            NOW,
            TZ
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

describe('buildYahooDividends', () => {
    it('트레일링 연 배당금과 현재가로 수익률을 계산하고 직전 1회 금액이 없으면 null이다', () => {
        const r = buildYahooDividends(
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
        const r = buildYahooDividends(
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
        const r = buildYahooDividends(
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
        const future = buildYahooDividends(
            summary({
                trailingAnnualDividendRate: 100,
                exDividendDate: '2026-12-29',
            }),
            1000,
            'KRW',
            TODAY
        );
        expect(future?.latestExDate).toBeNull();
        const fallback = buildYahooDividends(
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
        const r = buildYahooDividends(
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
        expect(buildYahooDividends(summary(), 1000, 'KRW', TODAY)).toBeNull();
    });

    it('직전 1회 금액·일자가 있으면 싣는다', () => {
        const r = buildYahooDividends(
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

describe('fetchDividendSource / buildDividends', () => {
    beforeEach(() => vi.clearAllMocks());

    it('미국은 FMP 이력을 읽고 buildDividends가 계산한다', async () => {
        getFmpDividendHistory.mockResolvedValue([
            row('2026-05-19', 0.6472, '2026-06-15'),
        ]);
        const source = await fetchDividendSource('FER', false);
        expect(getFmpDividendHistory).toHaveBeenCalledWith('FER');
        expect(getYahooDividendSummary).not.toHaveBeenCalled();
        const r = buildDividends(source, {
            price: 50,
            currency: 'USD',
            timeZone: TZ,
            now: NOW,
        });
        expect(r?.trailing12mAmount).toBe(0.6472);
        expect(r?.currency).toBe('USD');
    });

    it('한국은 yahoo 요약을 읽고 요약이 없으면 null이다', async () => {
        getYahooDividendSummary.mockResolvedValue(null);
        expect(await fetchDividendSource('005930.KS', true)).toBeNull();
        expect(getFmpDividendHistory).not.toHaveBeenCalled();
        expect(
            buildDividends(null, { price: 1, currency: 'KRW', timeZone: TZ })
        ).toBeNull();
    });

    it('한국 원자료는 시장 시간대의 오늘로 미래 배당락일을 거른다', async () => {
        getYahooDividendSummary.mockResolvedValue(
            summary({
                trailingAnnualDividendRate: 100,
                exDividendDate: '2026-10-26',
            })
        );
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
