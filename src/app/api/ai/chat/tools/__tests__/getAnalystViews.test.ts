import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    ANALYST_VIEWS_RESULT_MAX_CHARS,
    TOOL_RESULT_MAX_CHARS,
} from '@/app/api/ai/chat/tools/truncate';
import type { AnalystViews } from '@/entities/analyst-views/model';

const { isTabAllowed, getViews, getQuote, resolveProfile, assetInfo } =
    vi.hoisted(() => ({
        isTabAllowed: vi.fn(),
        getViews: vi.fn(),
        getQuote: vi.fn(),
        resolveProfile: vi.fn(),
        assetInfo: vi.fn(),
    }));
vi.mock('@/entities/ticker/api', () => ({
    isTabAllowedForSymbol: isTabAllowed,
}));
vi.mock('@/entities/analyst-views/server/getAnalystViews', () => ({
    getAnalystViews: getViews,
}));
vi.mock('@/entities/ticker/lib/resolveMarketProfile', () => ({
    resolveMarketProfile: resolveProfile,
}));
vi.mock('@/entities/ticker/server/getAssetInfo', () => ({
    getAssetInfo: assetInfo,
}));
vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({
    getCachedMarketDataProvider: () => ({ getQuote }),
}));
vi.mock('@/shared/api/market/sessionSpecFor', () => ({
    sessionSpecFor: () => ({}),
}));
vi.mock('@/shared/config/marketProfile/registry', () => ({
    getDescriptor: (id: string) => ({
        priceFormat: { currency: id === 'kr-equity' ? 'KRW' : 'USD' },
    }),
}));

import { getAnalystViewsTool } from '@/app/api/ai/chat/tools/getAnalystViews';

const ctx = {
    userId: 'u',
    tier: 'member' as const,
    locale: 'ko' as const,
    signal: new AbortController().signal,
};
const rt = {
    analysisModel: 'deepseek-v4.1-flash' as const,
    ensureSymbolData: async (): Promise<void> => {},
};

const ZERO = {
    upgrades: 0,
    downgrades: 0,
    initiations: 0,
    targetRaises: 0,
    targetCuts: 0,
};

const FIRMS = [
    'Morgan Stanley',
    'B of A Securities',
    'Goldman Sachs',
    'JP Morgan',
    'Wells Fargo',
    'Truist Securities',
    'Rosenblatt',
    'Craig-Hallum',
];
const GRADES = ['Sector Outperform', 'Equal-Weight', 'Market Perform', 'Buy'];

function rows(n: number) {
    return Array.from({ length: n }, (_, i) => ({
        date: `2026-11-${String(13 - (i % 12)).padStart(2, '0')}`,
        firm: FIRMS[i % FIRMS.length]!,
        action: 'downgrade' as const,
        fromGrade: GRADES[i % GRADES.length]!,
        toGrade: GRADES[(i + 1) % GRADES.length]!,
        priorTarget: 346.5 + i,
        target: 174.25 + i,
        targetAction: 'lower' as const,
    }));
}

/** 실제보다 무거운 추정치 4기간(긴 소수·12자리 매출). */
const ESTIMATES: NonNullable<AnalystViews['estimates']> = [
    '0q',
    '+1q',
    '0y',
    '+1y',
].map(period => ({
    period,
    endDate: '2027-01-31',
    eps: {
        avg: -12345.6789,
        analysts: 57,
        ago7d: -12345.6789,
        ago30d: -12345.6789,
        ago60d: -12345.6789,
        ago90d: -12345.6789,
        change30d: -1234.5678,
        change90d: -1234.5678,
    },
    revisions: { up7d: 12, down7d: 12, up30d: 12, down30d: 12 },
    revenue: { avg: 1017420394730000, analysts: 57, growthPct: 292.62 },
}));

function views(over: Partial<AnalystViews> = {}): AnalystViews {
    return {
        estimates: null,
        asOf: '2026-11-15T12:00:00.000Z',
        symbol: 'NVDA',
        targets: {
            yahoo: {
                mean: 276.56,
                median: 280,
                low: 150,
                high: 400,
                analysts: 53,
            },
            fmp: {
                consensus: 312.345678,
                median: 300,
                low: 200,
                high: 450,
                lastMonth: { count: null, avg: 310.123 },
                lastQuarter: { count: null, avg: 305.456 },
            },
            gapPct: 12.94,
            sourcesDisagree: true,
        },
        ratings: {
            strongBuy: 10,
            buy: 37,
            hold: 14,
            sell: 0,
            strongSell: 0,
            analysts: 61,
            source: 'yahoo',
        },
        actions: {
            available: true,
            rows: rows(40),
            tally: {
                last30d: { ...ZERO, downgrades: 30, targetCuts: 30 },
                last90d: { ...ZERO, downgrades: 58, targetCuts: 50 },
            },
        },
        earnings: {
            date: '2026-11-17',
            isEstimate: false,
            session: 'after_market',
            callAt: null,
        },
        degraded: [],
        ...over,
    };
}

describe('getAnalystViewsTool', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        isTabAllowed.mockResolvedValue(true);
        getViews.mockResolvedValue(views());
        getQuote.mockResolvedValue({ price: 190.1 });
        resolveProfile.mockResolvedValue('us-equity');
        assetInfo.mockResolvedValue({ fmpSymbol: 'NVDA' });
    });

    const run = (symbol = 'nvda') =>
        getAnalystViewsTool({ symbol }, ctx, rt) as Promise<
            Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
        >;

    it('펀더멘털 탭이 없는 심볼은 not_a_stock이고 아무것도 부르지 않는다', async () => {
        isTabAllowed.mockResolvedValue(false);
        expect(await run('BTCUSD')).toEqual({
            symbol: 'BTCUSD',
            available: false,
            reason: 'not_a_stock',
        });
        expect(isTabAllowed).toHaveBeenCalledWith('BTCUSD', 'fundamental');
        expect(getViews).not.toHaveBeenCalled();
    });

    it('목표가마다 upsidePct를 붙이고 earnings는 싣지 않는다', async () => {
        const r = await run();
        expect(r.available).toBe(true);
        expect(r.symbol).toBe('NVDA');
        expect(r.price).toBe(190.1);
        expect(r.currency).toBe('USD');
        expect(r.source).toBe('analyst views (Yahoo Finance, FMP)');
        expect(r.targets.yahoo.upsidePct).toBeCloseTo(45.48, 1);
        expect(r.targets.fmp.upsidePct).toBeCloseTo(64.3, 0);
        expect(r.targets.sourcesDisagree).toBe(true);
        expect(r.targets.gapPct).toBe(12.94);
        expect(r).not.toHaveProperty('earnings');
        expect(r.degraded).toEqual([]);
    });

    it('이력은 15건으로 자르되 집계는 그대로 둔다', async () => {
        const r = await run();
        expect(r.actions.rows).toHaveLength(15);
        expect(r.actions.tally.last30d.downgrades).toBe(30);
    });

    it('시세가 없으면 price와 upsidePct는 null', async () => {
        getQuote.mockResolvedValue(null);
        const r = await run();
        expect(r.price).toBeNull();
        expect(r.targets.yahoo.upsidePct).toBeNull();
        expect(r.targets.fmp.upsidePct).toBeNull();
    });

    it('시세 조회가 거부돼도 도구는 실패하지 않는다', async () => {
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});
        getQuote.mockRejectedValue(new Error('boom'));
        expect((await run()).price).toBeNull();
        err.mockRestore();
    });

    it('한 출처가 null이면 그 블록만 null', async () => {
        const v = views();
        getViews.mockResolvedValue(
            views({
                targets: {
                    ...v.targets,
                    fmp: null,
                    gapPct: null,
                    sourcesDisagree: false,
                },
                degraded: ['fmp'],
            })
        );
        const r = await run();
        expect(r.targets.fmp).toBeNull();
        expect(r.targets.yahoo).not.toBeNull();
        expect(r.degraded).toEqual(['fmp']);
    });

    const empty = (degraded: ('yahoo' | 'fmp')[]) =>
        views({
            targets: {
                yahoo: null,
                fmp: null,
                gapPct: null,
                sourcesDisagree: false,
            },
            ratings: null,
            actions: {
                available: true,
                rows: [],
                tally: { last30d: ZERO, last90d: ZERO },
            },
            degraded,
        });

    it('목표가·의견·이력이 모두 없고 degraded면 provider_failed', async () => {
        getViews.mockResolvedValue(empty(['yahoo', 'fmp']));
        expect(await run()).toEqual({
            symbol: 'NVDA',
            available: false,
            reason: 'provider_failed',
        });
    });

    it('모두 없는데 degraded도 비었으면(ETF 등) no_analyst_data', async () => {
        getViews.mockResolvedValue(empty([]));
        expect(await run('SPY')).toEqual({
            symbol: 'SPY',
            available: false,
            reason: 'no_analyst_data',
        });
    });

    it('이력만 남아 있으면 degraded여도 provider_failed가 아니다', async () => {
        const v = views();
        getViews.mockResolvedValue(
            views({
                targets: {
                    yahoo: null,
                    fmp: null,
                    gapPct: null,
                    sourcesDisagree: false,
                },
                ratings: null,
                degraded: ['fmp'],
                actions: v.actions,
            })
        );
        expect((await run()).available).toBe(true);
    });

    it('한국 종목은 KRW, 이력 없음(available false)으로 낸다', async () => {
        resolveProfile.mockResolvedValue('kr-equity');
        const v = views();
        getViews.mockResolvedValue(
            views({
                symbol: '005930.KS',
                targets: {
                    ...v.targets,
                    fmp: null,
                    gapPct: null,
                    sourcesDisagree: false,
                },
                actions: {
                    available: false,
                    rows: [],
                    tally: null,
                },
            })
        );
        const r = await run('005930.KS');
        expect(r.currency).toBe('KRW');
        expect(r.actions.available).toBe(false);
        expect(r.actions.rows).toEqual([]);
        expect(r.actions.tally).toBeNull();
    });

    it('Yahoo 실패로 이력을 못 읽었으면 tally는 null이고 degraded에 yahoo가 남는다', async () => {
        const v = views();
        getViews.mockResolvedValue(
            views({
                targets: {
                    ...v.targets,
                    yahoo: null,
                    gapPct: null,
                    sourcesDisagree: false,
                },
                actions: { available: false, rows: [], tally: null },
                degraded: ['yahoo'],
            })
        );
        const r = await run();
        expect(r.available).toBe(true); // FMP 목표가가 남아 있다
        expect(r.actions.tally).toBeNull();
        expect(r.degraded).toEqual(['yahoo']);
    });

    it('시세 조회와 뷰 조회는 서로 기다리지 않고 함께 시작된다', async () => {
        let release!: () => void;
        getViews.mockImplementation(
            () =>
                new Promise(resolve => {
                    release = () => resolve(views());
                })
        );
        const pending = run();
        // 뷰가 끝나지 않았어도 시세 요청은 이미 나갔다.
        await vi.waitFor(() => expect(getQuote).toHaveBeenCalled());
        release();
        expect((await pending).available).toBe(true);
    });

    it('15행 + 추정치 4기간(실제보다 무거운 값)이 전용 상한 안이고, 추정치는 그대로 실린다', async () => {
        getViews.mockResolvedValue(views({ estimates: ESTIMATES }));
        const result = await run();
        const size = JSON.stringify(result).length;
        // 2026-11-16 실측 4,721자.
        expect(size).toBeGreaterThan(4_500);
        expect(size).toBeLessThan(ANALYST_VIEWS_RESULT_MAX_CHARS);
        // 결과 숫자는 유효숫자 6자리로 줄어든다(`roundNumbersDeep`).
        expect(result).toMatchObject({
            estimates: ESTIMATES.map(e => ({
                period: e.period,
                eps: { avg: -12345.7, change30d: -1234.57 },
            })),
        });
    });

    it('긴 증권사명·등급을 담은 15행 결과가 표준 상한(4,000자) 안이다', async () => {
        const size = JSON.stringify(await run()).length;
        // 넘으면 상한을 올리지 말고 ANALYST_ACTION_ROWS_MAX를 줄일 것.
        // 2026-11-15 실측 3,437자. 아래 하한은 픽스처가 실제 크기를 대표하는지(비어 있지 않은지) 지킨다.
        expect(size).toBeGreaterThan(3_000);
        expect(size).toBeLessThan(TOOL_RESULT_MAX_CHARS);
    });
});
