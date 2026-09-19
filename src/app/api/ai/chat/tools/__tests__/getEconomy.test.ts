import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { snapshot, briefing } = vi.hoisted(() => ({
    snapshot: vi.fn(),
    briefing: vi.fn(),
}));
vi.mock('@/entities/economy/api/economySnapshotStaticCache', () => ({
    getEconomySnapshotStatic: snapshot,
}));
vi.mock('@/entities/economy/api/macroBriefingStaticCache', () => ({
    peekMacroBriefingStatic: briefing,
}));

import { getEconomyTool } from '@/app/api/ai/chat/tools/getEconomy';

const ctx = {
    userId: 'u',
    tier: 'member' as const,
    locale: 'ko' as const,
    signal: new AbortController().signal,
};
const rt = { analysisModel: 'deepseek-v4.1-flash' as const };
const DAY_MS = 24 * 60 * 60 * 1000;

describe('getEconomyTool', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-09-14T00:00:00.000Z'));
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('스냅샷이 없으면 available:false', async () => {
        snapshot.mockRejectedValue(new Error('redis down'));
        const r = await getEconomyTool({}, ctx, rt);
        expect(r).toEqual({
            available: false,
            reason: 'snapshot_unavailable',
        });
        expect(briefing).not.toHaveBeenCalled();
    });

    it('캘린더는 향후 7일 창으로만 필터링되고 브리핑을 함께 반환한다', async () => {
        const inWindow = new Date(Date.now() + 3 * DAY_MS).toISOString();
        const tooFar = new Date(Date.now() + 10 * DAY_MS).toISOString();
        const past = new Date(Date.now() - DAY_MS).toISOString();
        snapshot.mockResolvedValue({
            indicators: [
                {
                    name: 'federalFunds',
                    latest: { date: '2026-09-01', value: 4.5 },
                    previous: { date: '2026-08-01', value: 4.5 },
                    trend: [],
                },
            ],
            treasury: { date: '2026-09-12', year2: 3.9, year10: 4.1 },
            calendar: [
                {
                    date: inWindow,
                    event: 'CPI YoY',
                    impact: 'High',
                    actual: null,
                    estimate: 3.1,
                    previous: 3.0,
                    unit: '%',
                },
                {
                    date: tooFar,
                    event: 'FOMC',
                    impact: 'High',
                    actual: null,
                    estimate: null,
                    previous: null,
                    unit: '%',
                },
                {
                    date: past,
                    event: 'Past release',
                    impact: 'Low',
                    actual: 1,
                    estimate: 1,
                    previous: 1,
                    unit: '%',
                },
            ],
        });
        briefing.mockResolvedValue({
            summary: '완만한 성장세가 이어지고 있습니다.',
            highlights: [],
            regime: 'expansion',
        });

        const r = (await getEconomyTool({}, ctx, rt)) as {
            available: boolean;
            upcomingCalendar: Array<{ event: string }>;
            briefing: { regime: string };
        };
        expect(r.available).toBe(true);
        expect(r.upcomingCalendar).toHaveLength(1);
        expect(r.upcomingCalendar[0]!.event).toBe('CPI YoY');
        expect(r.briefing.regime).toBe('expansion');
    });

    it('FMP의 존 표시 없는 UTC 일시를 ISO 인스턴트로 바꿔 창 필터와 사용자 시간대 변환이 맞게 된다', async () => {
        // 2026-09-15 12:30 UTC = 21:30 KST. 서버 로컬 시간으로 읽히거나 존 없이
        // 넘어가면 모델이 "12:30"을 한국 시각처럼 옮긴다.
        snapshot.mockResolvedValue({
            indicators: [],
            treasury: null,
            calendar: [
                {
                    date: '2026-09-15 12:30:00',
                    event: 'NY Empire State Manufacturing Index',
                    impact: 'High',
                    actual: null,
                    estimate: 15,
                    previous: 20.6,
                    unit: null,
                },
                {
                    // 창 밖(현재 2026-09-14T00:00Z 이전) — 로컬 파싱이면 경계가 흔들린다.
                    date: '2026-09-13 23:30:00',
                    event: 'Past',
                    impact: 'Low',
                    actual: 1,
                    estimate: 1,
                    previous: 1,
                    unit: null,
                },
            ],
        });
        briefing.mockResolvedValue(null);
        const r = (await getEconomyTool({}, ctx, rt)) as {
            upcomingCalendar: Array<{ date: string; event: string }>;
        };
        expect(r.upcomingCalendar).toEqual([
            expect.objectContaining({
                date: '2026-09-15T12:30:00Z',
                event: 'NY Empire State Manufacturing Index',
            }),
        ]);
    });

    it('통합: 이미 ISO 인스턴트인 날짜는 shared 헬퍼를 거쳐도 그대로 유지된다', async () => {
        // 형식 가드/경고 자체는 `fmpCalendarDateTimeToIso`(shared/lib/etTimeUtils)
        // 테스트가 책임진다. 여기서는 getEconomyTool이 그 헬퍼와 올바르게
        // 연결돼 있는지만 확인한다.
        snapshot.mockResolvedValue({
            indicators: [],
            treasury: null,
            calendar: [
                {
                    date: '2026-09-15T12:30:00Z',
                    event: 'Already ISO',
                    impact: 'High',
                    actual: null,
                    estimate: null,
                    previous: null,
                    unit: null,
                },
            ],
        });
        briefing.mockResolvedValue(null);
        const r = (await getEconomyTool({}, ctx, rt)) as {
            upcomingCalendar: Array<{ date: string }>;
        };
        expect(r.upcomingCalendar).toEqual([
            expect.objectContaining({ date: '2026-09-15T12:30:00Z' }),
        ]);
    });

    it('브리핑 조회가 실패해도(catch) 스냅샷 나머지 필드는 반환된다', async () => {
        snapshot.mockResolvedValue({
            indicators: [],
            treasury: null,
            calendar: [],
        });
        briefing.mockRejectedValue(new Error('cache miss'));
        const r = (await getEconomyTool({}, ctx, rt)) as {
            available: boolean;
            briefing: unknown;
        };
        expect(r.available).toBe(true);
        expect(r.briefing).toBeNull();
    });

    describe('indicator change/direction, treasury spread, calendar hoursUntil (spec §3.6, B8)', () => {
        it('latest-previous로 change/direction을 계산한다', async () => {
            snapshot.mockResolvedValue({
                indicators: [
                    {
                        name: 'federalFunds',
                        unit: '%',
                        latest: { date: '2026-09-01', value: 4.5 },
                        previous: { date: '2026-08-01', value: 4.25 },
                        trend: [],
                    },
                    {
                        name: 'unemploymentRate',
                        unit: '%',
                        latest: { date: '2026-09-01', value: 4.0 },
                        previous: { date: '2026-08-01', value: 4.2 },
                        trend: [],
                    },
                    {
                        name: 'cpi',
                        latest: { date: '2026-09-01', value: 3.0 },
                        previous: { date: '2026-08-01', value: 3.0 },
                        trend: [],
                    },
                    {
                        name: 'newIndicator',
                        latest: { date: '2026-09-01', value: 1 },
                        previous: null,
                        trend: [],
                    },
                ],
                treasury: null,
                calendar: [],
            });
            briefing.mockResolvedValue(null);
            const r = (await getEconomyTool({}, ctx, rt)) as {
                indicators: Array<{
                    name: string;
                    unit: string | null;
                    change: number | null;
                    changeUnit: 'pp' | 'level';
                    direction: string | null;
                }>;
            };
            expect(r.indicators[0]).toMatchObject({
                unit: '%',
                change: expect.closeTo(0.25, 6),
                changeUnit: 'pp',
                direction: 'up',
            });
            expect(r.indicators[1]).toMatchObject({
                unit: '%',
                change: expect.closeTo(-0.2, 6),
                changeUnit: 'pp',
                direction: 'down',
            });
            expect(r.indicators[2]).toMatchObject({
                unit: null,
                change: 0,
                changeUnit: 'level',
                direction: 'unchanged',
            });
            expect(r.indicators[3]).toMatchObject({
                unit: null,
                change: null,
                // No previous value at all (null change) — the series is
                // still level-type (no `unit`), so changeUnit stays
                // descriptive metadata rather than depending on `change`
                // being non-null.
                changeUnit: 'level',
                direction: null,
            });
        });

        it('treasury.spread2s10s/curveInverted을 core computeYieldSpread로 계산한다', async () => {
            snapshot.mockResolvedValue({
                indicators: [],
                treasury: { date: '2026-09-12', year2: 4.1, year10: 3.9 }, // inverted
                calendar: [],
            });
            briefing.mockResolvedValue(null);
            const r = (await getEconomyTool({}, ctx, rt)) as {
                treasury: {
                    spread2s10s: number | null;
                    curveInverted: boolean | null;
                };
            };
            expect(r.treasury.spread2s10s).toBeCloseTo(3.9 - 4.1, 6);
            expect(r.treasury.curveInverted).toBe(true);
        });

        it('rounds the 2s10s spread instead of passing binary-float noise to the model', async () => {
            // Real data: 10y 4.10 − 2y 3.70 came out as 0.39999999999999947.
            snapshot.mockResolvedValue({
                indicators: [],
                treasury: { date: '2026-09-12', year2: 3.7, year10: 4.1 },
                calendar: [],
            });
            briefing.mockResolvedValue(null);
            const r = (await getEconomyTool({}, ctx, rt)) as {
                treasury: { spread2s10s: number | null };
            };
            expect(r.treasury.spread2s10s).toBe(0.4);
        });

        it('treasury가 null이면 그대로 null', async () => {
            snapshot.mockResolvedValue({
                indicators: [],
                treasury: null,
                calendar: [],
            });
            briefing.mockResolvedValue(null);
            const r = (await getEconomyTool({}, ctx, rt)) as {
                treasury: unknown;
            };
            expect(r.treasury).toBeNull();
        });

        it('캘린더 이벤트에 hoursUntil이 붙는다', async () => {
            const inThreeDays = new Date(Date.now() + 3 * DAY_MS).toISOString();
            snapshot.mockResolvedValue({
                indicators: [],
                treasury: null,
                calendar: [
                    {
                        date: inThreeDays,
                        event: 'CPI YoY',
                        impact: 'High',
                        actual: null,
                        estimate: 3.1,
                        previous: 3.0,
                        unit: '%',
                    },
                ],
            });
            briefing.mockResolvedValue(null);
            const r = (await getEconomyTool({}, ctx, rt)) as {
                upcomingCalendar: Array<{ hoursUntil: number }>;
            };
            expect(r.upcomingCalendar[0]!.hoursUntil).toBe(3 * 24);
        });
    });
});
