import { describe, expect, it } from 'vitest';
import type { YahooEstimatePeriod } from '@/shared/api/yahoo/yahooAnalystSource';
import type {
    YahooAnalystSummary,
    YahooRawAnalystAction,
} from '@/shared/api/yahoo/yahooAnalystSource';
import {
    buildAnalystViews,
    type BuildAnalystViewsInput,
} from '@/entities/analyst-views/lib/buildAnalystViews';
import { TARGET_DISAGREE_THRESHOLD_PCT } from '@/entities/analyst-views/model';

const NOW = new Date('2026-11-15T12:00:00Z');

const NO_TARGETS = {
    mean: null,
    median: null,
    low: null,
    high: null,
    analysts: null,
};

function summary(over: Partial<YahooAnalystSummary> = {}): YahooAnalystSummary {
    return {
        estimates: [],
        targets: {
            mean: 276.56,
            median: 280,
            low: 150,
            high: 400,
            analysts: 53,
        },
        trend: { strongBuy: 10, buy: 37, hold: 14, sell: 0, strongSell: 0 },
        actions: [],
        earnings: null,
        ...over,
    };
}

function raw(over: Partial<YahooRawAnalystAction> = {}): YahooRawAnalystAction {
    return {
        dateIso: '2026-11-13T21:32:15.000Z',
        firm: 'Rosenblatt',
        fromGrade: 'Buy',
        toGrade: 'Buy',
        action: 'main',
        priceTargetAction: 'Lowers',
        priorPriceTarget: 390,
        currentPriceTarget: 300,
        ...over,
    };
}

function fmpWith(consensus: number | null) {
    return {
        consensus: {
            targetConsensus: consensus,
            targetMedian: 300,
            targetLow: 200,
            targetHigh: 450,
        },
        summary: {
            lastMonth: { avgPriceTarget: 310 },
            lastQuarter: { avgPriceTarget: 305 },
            lastYear: { avgPriceTarget: 280 },
        },
    };
}

function build(over: Partial<BuildAnalystViewsInput> = {}) {
    return buildAnalystViews({
        symbol: 'NVDA',
        now: NOW,
        yahoo: summary(),
        fmp: fmpWith(300),
        fmpFailed: false,
        includeActions: true,
        includeEstimates: false,
        includeEarnings: true,
        ...over,
    });
}

describe('buildAnalystViews - ratings', () => {
    it('0m 행 분포와 합계를 싣는다', () => {
        expect(build().ratings).toEqual({
            strongBuy: 10,
            buy: 37,
            hold: 14,
            sell: 0,
            strongSell: 0,
            analysts: 61,
            source: 'yahoo',
        });
    });

    it('행이 없거나 합이 0이면 null', () => {
        expect(build({ yahoo: summary({ trend: null }) }).ratings).toBeNull();
        expect(
            build({
                yahoo: summary({
                    trend: {
                        strongBuy: 0,
                        buy: 0,
                        hold: 0,
                        sell: 0,
                        strongSell: 0,
                    },
                }),
            }).ratings
        ).toBeNull();
        expect(build({ yahoo: null }).ratings).toBeNull();
    });
});

describe('buildAnalystViews - targets', () => {
    it('양쪽이 있으면 gapPct = (fmp - yahoo.mean) / yahoo.mean * 100', () => {
        const t = build({ fmp: fmpWith(300) }).targets;
        expect(t.gapPct).toBeCloseTo(((300 - 276.56) / 276.56) * 100, 10);
        expect(t.fmp).toEqual({
            consensus: 300,
            median: 300,
            low: 200,
            high: 450,
            lastMonth: { count: null, avg: 310 },
            lastQuarter: { count: null, avg: 305 },
        });
    });

    it('FMP가 기간 평균을 0으로 채운 것(그 기간에 나온 목표가 없음)은 null이다 — 실측 LAES', () => {
        const fmp = fmpWith(7.5);
        const t = build({
            fmp: {
                ...fmp,
                summary: {
                    ...fmp.summary,
                    lastMonth: { avgPriceTarget: 0 },
                    lastQuarter: { avgPriceTarget: 0 },
                },
            },
        }).targets;
        expect(t.fmp?.lastMonth.avg).toBeNull();
        expect(t.fmp?.lastQuarter.avg).toBeNull();
        expect(t.fmp?.consensus).toBe(7.5);
    });

    it('임계값은 10이고, 정확히 10%는 불일치가 아니다', () => {
        expect(TARGET_DISAGREE_THRESHOLD_PCT).toBe(10);
        const exactly = build({
            yahoo: summary({
                targets: { ...NO_TARGETS, mean: 100, analysts: 5 },
            }),
            fmp: fmpWith(110),
        }).targets;
        expect(exactly.gapPct).toBeCloseTo(10, 9);
        expect(exactly.sourcesDisagree).toBe(false);
    });

    it('10%를 조금이라도 넘으면 불일치(양방향)', () => {
        const yahoo = summary({
            targets: { ...NO_TARGETS, mean: 100, analysts: 5 },
        });
        expect(
            build({ yahoo, fmp: fmpWith(110.01) }).targets.sourcesDisagree
        ).toBe(true);
        expect(
            build({ yahoo, fmp: fmpWith(89.99) }).targets.sourcesDisagree
        ).toBe(true);
        expect(build({ yahoo, fmp: fmpWith(90) }).targets.sourcesDisagree).toBe(
            false
        );
    });

    it('yahoo.mean이 null이면 yahoo=null, gap 없음', () => {
        const t = build({
            yahoo: summary({ targets: { ...NO_TARGETS, analysts: 3 } }),
        }).targets;
        expect(t.yahoo).toBeNull();
        expect(t.gapPct).toBeNull();
        expect(t.sourcesDisagree).toBe(false);
    });

    it('yahoo.mean이 0 이하면 gap을 계산하지 않는다', () => {
        const t = build({
            yahoo: summary({ targets: { ...NO_TARGETS, mean: 0 } }),
        }).targets;
        expect(t.yahoo).not.toBeNull();
        expect(t.gapPct).toBeNull();
    });

    it('fmp.consensus가 null이면 fmp=null이지만 degraded는 아니다', () => {
        const v = build({ fmp: fmpWith(null) });
        expect(v.targets.fmp).toBeNull();
        expect(v.targets.gapPct).toBeNull();
        expect(v.degraded).toEqual([]);
    });

    it('한국 종목 형태(fmp=null)는 fmp=null', () => {
        const v = build({
            fmp: null,
            includeActions: false,
            includeEarnings: false,
            yahoo: summary({ actions: null }),
        });
        expect(v.targets.fmp).toBeNull();
        expect(v.degraded).toEqual([]);
    });
});

describe('buildAnalystViews - degraded', () => {
    it('Yahoo null이면 yahoo, FMP reject이면 fmp', () => {
        expect(build({ yahoo: null }).degraded).toEqual(['yahoo']);
        expect(build({ fmpFailed: true, fmp: null }).degraded).toEqual(['fmp']);
        expect(
            build({ yahoo: null, fmpFailed: true, fmp: null }).degraded
        ).toEqual(['yahoo', 'fmp']);
    });

    it('Yahoo가 null이면 이력은 사용 불가', () => {
        const a = build({ yahoo: null }).actions;
        expect(a.available).toBe(false);
        expect(a.rows).toEqual([]);
        // Yahoo 실패를 "변경 없음"으로 읽히게 하는 0건 집계는 내지 않는다. 구분은 degraded다.
        expect(a.tally).toBeNull();
        expect(build({ yahoo: null }).degraded).toContain('yahoo');
    });
});

describe('buildAnalystViews - actions', () => {
    const kindOf = (action: string | null) =>
        build({ yahoo: summary({ actions: [raw({ action })] }) }).actions
            .rows[0]!.action;

    it.each([
        ['up', 'upgrade'],
        ['down', 'downgrade'],
        ['main', 'maintain'],
        ['init', 'initiate'],
        ['reit', 'reiterate'],
        ['UP', 'upgrade'],
        ['weird', 'maintain'],
        [null, 'maintain'],
    ])('action %j -> %s', (input, expected) => {
        expect(kindOf(input)).toBe(expected);
    });

    const targetOf = (priceTargetAction: string | null) =>
        build({ yahoo: summary({ actions: [raw({ priceTargetAction })] }) })
            .actions.rows[0]!.targetAction;

    it.each([
        ['Raises', 'raise'],
        ['Lowers', 'lower'],
        ['Maintains', 'maintain'],
        ['Announces', 'announce'],
        ['lowers', 'lower'],
        ['RAISES', 'raise'],
        ['Reiterates', null],
        ['', null],
        [null, null],
    ])('priceTargetAction %j -> %j', (input, expected) => {
        expect(targetOf(input)).toBe(expected);
    });

    it('목표가 0·음수·비유한은 null, 양수는 유지(Yahoo의 "없음"은 0)', () => {
        const row = build({
            yahoo: summary({
                actions: [
                    raw({
                        firm: 'Craig-Hallum',
                        action: 'down',
                        priceTargetAction: 'Announces',
                        priorPriceTarget: 0,
                        currentPriceTarget: 180,
                    }),
                    raw({
                        firm: 'A',
                        priorPriceTarget: -5,
                        currentPriceTarget: NaN,
                    }),
                    raw({
                        firm: 'B',
                        priorPriceTarget: null,
                        currentPriceTarget: null,
                    }),
                ],
            }),
        }).actions.rows;
        expect(row[0]).toMatchObject({ priorTarget: null, target: 180 });
        expect(row[1]).toMatchObject({ priorTarget: null, target: null });
        expect(row[2]).toMatchObject({ priorTarget: null, target: null });
    });

    it('날짜는 UTC 자르기, 빈 등급 문자열은 null', () => {
        const r = build({
            yahoo: summary({
                actions: [
                    raw({
                        dateIso: '2026-11-13T23:59:59.000Z',
                        fromGrade: '',
                        toGrade: '  ',
                    }),
                ],
            }),
        }).actions.rows[0]!;
        expect(r.date).toBe('2026-11-13');
        expect(r.fromGrade).toBeNull();
        expect(r.toGrade).toBeNull();
    });

    it('날짜가 없거나 잘못됐거나 firm이 비면 행을 버린다', () => {
        const rows = build({
            yahoo: summary({
                actions: [
                    raw({ dateIso: null }),
                    raw({ dateIso: 'garbage' }),
                    raw({ firm: '' }),
                    raw({ firm: null }),
                    raw({ firm: 'Keep' }),
                ],
            }),
        }).actions.rows;
        expect(rows.map(r => r.firm)).toEqual(['Keep']);
    });

    it('입력이 뒤섞여도 최신순으로 돌려준다', () => {
        const rows = build({
            yahoo: summary({
                actions: [
                    raw({ firm: 'old', dateIso: '2026-10-01T00:00:00.000Z' }),
                    raw({ firm: 'new', dateIso: '2026-11-14T00:00:00.000Z' }),
                    raw({ firm: 'mid', dateIso: '2026-11-01T00:00:00.000Z' }),
                ],
            }),
        }).actions.rows;
        expect(rows.map(r => r.firm)).toEqual(['new', 'mid', 'old']);
    });

    it('빈 이력이면 available은 true, rows는 []', () => {
        const a = build({ yahoo: summary({ actions: [] }) }).actions;
        expect(a.available).toBe(true);
        expect(a.rows).toEqual([]);
        // 읽었고 비어 있으면 0건 집계는 진짜 "변경 없음"이다.
        expect(a.tally?.last30d.upgrades).toBe(0);
        expect(a.tally?.last90d.targetCuts).toBe(0);
    });

    it('이력을 요청하지 않은 요약(actions null)은 available false·tally null이고 degraded가 아니다', () => {
        const v = build({ yahoo: summary({ actions: null }) });
        expect(v.actions.available).toBe(false);
        expect(v.actions.tally).toBeNull();
        expect(v.degraded).toEqual([]);
    });

    it('ETF처럼 비어 있는 요약은 degraded가 아니다', () => {
        const v = build({
            yahoo: summary({
                targets: { ...NO_TARGETS },
                trend: null,
                actions: [],
                earnings: null,
            }),
            fmp: null,
        });
        expect(v.degraded).toEqual([]);
        expect(v.targets.yahoo).toBeNull();
        expect(v.ratings).toBeNull();
    });

    it('includeActions=false(한국)면 available false, 이력·집계 모두 0', () => {
        const a = build({
            includeActions: false,
            yahoo: summary({ actions: [raw()] }),
        }).actions;
        expect(a.available).toBe(false);
        expect(a.rows).toEqual([]);
        expect(a.tally).toBeNull();
    });
});

describe('buildAnalystViews - tally windows', () => {
    // now = 2026-11-15 -> 30일 창 시작 2026-10-16, 90일 창 시작 2026-08-17
    const at = (date: string, over: Partial<YahooRawAnalystAction> = {}) =>
        raw({ dateIso: `${date}T10:00:00.000Z`, ...over });

    it('경계일은 포함하고 하루 전은 제외한다(30일/90일)', () => {
        const v = build({
            yahoo: summary({
                actions: [
                    at('2026-10-16', {
                        action: 'up',
                        priceTargetAction: 'Raises',
                    }),
                    at('2026-10-15', {
                        action: 'up',
                        priceTargetAction: 'Raises',
                    }),
                    at('2026-08-17', {
                        action: 'down',
                        priceTargetAction: 'Lowers',
                    }),
                    at('2026-08-16', {
                        action: 'down',
                        priceTargetAction: 'Lowers',
                    }),
                ],
            }),
        });
        expect(v.actions.tally!.last30d).toEqual({
            upgrades: 1,
            downgrades: 0,
            initiations: 0,
            targetRaises: 1,
            targetCuts: 0,
        });
        expect(v.actions.tally!.last90d).toEqual({
            upgrades: 2,
            downgrades: 1,
            initiations: 0,
            targetRaises: 2,
            targetCuts: 1,
        });
    });

    it('오늘 날짜 행은 포함하고 미래 날짜 행은 제외한다', () => {
        const v = build({
            yahoo: summary({
                actions: [
                    at('2026-11-15', { action: 'init' }),
                    at('2026-11-16', { action: 'init' }),
                ],
            }),
        });
        expect(v.actions.tally!.last30d.initiations).toBe(1);
    });

    it('집계는 rows를 자르지 않은 전체 이력에서 계산한다', () => {
        const many = Array.from({ length: 40 }, (_, i) =>
            at('2026-11-10', {
                firm: `Firm ${i}`,
                action: 'down',
                priceTargetAction: 'Lowers',
            })
        );
        const v = build({ yahoo: summary({ actions: many }) });
        expect(v.actions.rows).toHaveLength(40);
        expect(v.actions.tally!.last30d.downgrades).toBe(40);
        expect(v.actions.tally!.last30d.targetCuts).toBe(40);
    });

    it('목표가 maintain/announce와 reiterate는 어느 집계에도 들어가지 않는다', () => {
        const v = build({
            yahoo: summary({
                actions: [
                    at('2026-11-10', {
                        action: 'reit',
                        priceTargetAction: 'Maintains',
                    }),
                    at('2026-11-10', {
                        action: 'main',
                        priceTargetAction: 'Announces',
                    }),
                ],
            }),
        });
        expect(v.actions.tally!.last30d).toEqual({
            upgrades: 0,
            downgrades: 0,
            initiations: 0,
            targetRaises: 0,
            targetCuts: 0,
        });
    });
});

describe('buildAnalystViews - earnings', () => {
    const earn = (
        dateIso: string | null,
        over: Partial<NonNullable<YahooAnalystSummary['earnings']>> = {}
    ) =>
        summary({
            earnings: {
                dateIso,
                callDateIso: null,
                isEstimate: false,
                ...over,
            },
        });

    it('한국 형태(includeEarnings=false)면 null', () => {
        expect(
            build({
                yahoo: earn('2026-11-17T21:00:00.000Z'),
                includeEarnings: false,
            }).earnings
        ).toBeNull();
    });

    it('Yahoo가 지난 날짜를 그대로 두면 null', () => {
        expect(
            build({ yahoo: earn('2026-08-27T20:00:00.000Z') }).earnings
        ).toBeNull();
    });

    it('발표 순간이 now보다 앞이면 같은 날이어도 null', () => {
        expect(
            build({ yahoo: earn('2026-11-15T11:59:00.000Z') }).earnings
        ).toBeNull();
    });

    it('날짜가 없거나 해석 불가면 null', () => {
        expect(build({ yahoo: earn(null) }).earnings).toBeNull();
        expect(build({ yahoo: earn('nope') }).earnings).toBeNull();
        expect(
            build({ yahoo: summary({ earnings: null }) }).earnings
        ).toBeNull();
    });

    it('날짜는 미국 동부 달력 날짜다(UTC로는 다음 날)', () => {
        const e = build({ yahoo: earn('2026-11-17T02:00:00.000Z') }).earnings;
        expect(e?.date).toBe('2026-11-16');
    });

    // 11월 평일은 EST(UTC-5)
    it.each([
        ['2026-11-17T14:29:00.000Z', 'before_market'], // 09:29 ET
        ['2026-11-17T14:30:00.000Z', 'during_market'], // 09:30 ET
        ['2026-11-17T20:59:00.000Z', 'during_market'], // 15:59 ET
        ['2026-11-17T21:00:00.000Z', 'after_market'], // 16:00 ET
        ['2026-11-17T13:00:00.000Z', 'before_market'], // 08:00 ET
    ])('확정일 %s -> %s', (iso, session) => {
        const e = build({ yahoo: earn(iso) }).earnings;
        expect(e?.session).toBe(session);
        expect(e?.isEstimate).toBe(false);
    });

    it('DST(EDT, UTC-4)에서도 ET 벽시계로 판정한다', () => {
        const now = new Date('2026-06-01T00:00:00Z');
        const at = (iso: string) =>
            build({ now, yahoo: earn(iso) }).earnings?.session;
        expect(at('2026-07-16T13:29:00.000Z')).toBe('before_market'); // 09:29 EDT
        expect(at('2026-07-16T13:30:00.000Z')).toBe('during_market'); // 09:30 EDT
        expect(at('2026-07-16T19:59:00.000Z')).toBe('during_market'); // 15:59 EDT
        expect(at('2026-07-16T20:00:00.000Z')).toBe('after_market'); // 16:00 EDT
    });

    it('DST 해제일(2026-11-01) 당일은 해제 후 오프셋(EST)으로 읽는다', () => {
        const now = new Date('2026-10-20T00:00:00Z');
        const at = (iso: string) => build({ now, yahoo: earn(iso) }).earnings;
        expect(at('2026-11-01T14:29:00.000Z')?.session).toBe('before_market'); // 09:29 EST
        expect(at('2026-11-01T14:30:00.000Z')?.session).toBe('during_market'); // 09:30 EST
        expect(at('2026-11-01T14:30:00.000Z')?.date).toBe('2026-11-01');
    });

    it('isEstimate는 3상태이고 세션은 false일 때만 채운다', () => {
        const iso = '2026-11-17T21:00:00.000Z';
        expect(
            build({ yahoo: earn(iso, { isEstimate: true }) }).earnings
        ).toMatchObject({
            isEstimate: true,
            session: null,
        });
        expect(
            build({ yahoo: earn(iso, { isEstimate: null }) }).earnings
        ).toMatchObject({
            isEstimate: null,
            session: null,
        });
        expect(
            build({ yahoo: earn(iso, { isEstimate: false }) }).earnings
        ).toMatchObject({
            isEstimate: false,
            session: 'after_market',
        });
    });

    it('콜 시각은 발표일(ET)과 같은 날일 때만 싣는다(지난 분기 콜은 버린다)', () => {
        const iso = '2026-11-17T21:00:00.000Z';
        expect(
            build({
                yahoo: earn(iso, { callDateIso: '2026-11-17T22:00:00.000Z' }),
            }).earnings?.callAt
        ).toBe('2026-11-17T22:00:00.000Z');
        expect(
            build({
                yahoo: earn(iso, { callDateIso: '2026-08-27T22:00:00.000Z' }),
            }).earnings?.callAt
        ).toBeNull();
        expect(
            build({ yahoo: earn(iso, { callDateIso: null }) }).earnings?.callAt
        ).toBeNull();
    });

    it('asOf는 주입한 now다', () => {
        expect(build().asOf).toBe(NOW.toISOString());
    });
});

describe('buildAnalystViews - estimates', () => {
    const period = (
        over: Partial<YahooEstimatePeriod> = {}
    ): YahooEstimatePeriod => ({
        period: '0y',
        endDate: '2026-12-31',
        epsAvg: -2.22907,
        epsAnalysts: 7,
        eps7dAgo: -4.08,
        eps30dAgo: -4.15167,
        eps60dAgo: -4.48333,
        eps90dAgo: -3.72761,
        up7d: 2,
        down7d: 0,
        up30d: 2,
        down30d: 0,
        revenueAvg: 510465900,
        revenueAnalysts: 12,
        revenueGrowth: 2.9262,
        ...over,
    });

    it('변화는 현재 − 과거(주당 절대값), 매출 성장률은 퍼센트(적자 EPS의 개선은 양수)', () => {
        const views = build({
            yahoo: summary({ estimates: [period()] }),
            includeEstimates: true,
        });
        const [period0] = views.estimates ?? [];
        expect(period0).toMatchObject({
            period: '0y',
            endDate: '2026-12-31',
            eps: {
                avg: -2.22907,
                analysts: 7,
                ago7d: -4.08,
                ago30d: -4.15167,
                ago60d: -4.48333,
                ago90d: -3.72761,
            },
            revisions: { up7d: 2, down7d: 0, up30d: 2, down30d: 0 },
            revenue: { avg: 510465900, analysts: 12, growthPct: 292.62 },
        });
        // 반올림은 도구 경계가 한다 — 여기서는 부동소수 그대로다.
        expect(period0?.eps.change30d).toBeCloseTo(1.9226, 10);
        expect(period0?.eps.change90d).toBeCloseTo(1.49854, 10);
    });

    it('과거 값이 없으면 변화는 null, 매출만 있는 기간은 남기고 EPS·매출이 둘 다 없는 기간은 버린다', () => {
        const views = build({
            yahoo: summary({
                estimates: [
                    period({ eps30dAgo: null }),
                    period({ period: '+1y', epsAvg: null }),
                    period({ period: '+1q', epsAvg: null, revenueAvg: null }),
                ],
            }),
            includeEstimates: true,
        });
        expect(views.estimates?.map(e => e.period)).toEqual(['0y', '+1y']);
        expect(views.estimates?.[0]?.eps.change30d).toBeNull();
        expect(views.estimates?.[1]?.eps.change30d).toBeNull();
        expect(
            build({
                yahoo: summary({
                    estimates: [period({ epsAvg: null, revenueAvg: null })],
                }),
                includeEstimates: true,
            }).estimates
        ).toBeNull();
    });

    it('변화가 0이면 -0이 아니라 0이다', () => {
        const views = build({
            yahoo: summary({
                estimates: [period({ epsAvg: -1.5, eps30dAgo: -1.5 })],
            }),
            includeEstimates: true,
        });
        expect(Object.is(views.estimates?.[0]?.eps.change30d, 0)).toBe(true);
    });

    it('가벼운 조회(includeEstimates false)나 Yahoo 실패면 null', () => {
        expect(
            build({ yahoo: summary({ estimates: [period()] }) }).estimates
        ).toBeNull();
        expect(
            build({ yahoo: null, includeEstimates: true }).estimates
        ).toBeNull();
    });
});
