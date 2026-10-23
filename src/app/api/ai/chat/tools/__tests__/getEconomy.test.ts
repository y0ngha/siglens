import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { snapshot, briefing, freshTreasury, calendarRange } = vi.hoisted(() => ({
    snapshot: vi.fn(),
    briefing: vi.fn(),
    freshTreasury: vi.fn(),
    calendarRange: vi.fn(),
}));
// 국채 단독 읽기는 Redis/FMP로 나간다 — 기본값 null(스냅샷 값 사용)로 막아 둔다.
vi.mock('@/entities/economy/api/treasuryRatesCache', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@/entities/economy/api/treasuryRatesCache')
    >()),
    getFreshTreasuryRates: freshTreasury,
}));
vi.mock('@/entities/economy/api/economySnapshotStaticCache', () => ({
    getEconomySnapshotStatic: snapshot,
}));
vi.mock('@/entities/economy/api/macroBriefingStaticCache', () => ({
    peekMacroBriefingStatic: briefing,
}));
// 범위 캘린더도 Redis/FMP로 나간다 — 테스트마다 행을 정한다(기본 []).
vi.mock('@/entities/economy/api/economicCalendarRangeCache', () => ({
    getEconomicCalendarRange: calendarRange,
}));

import { getEconomyTool } from '@/app/api/ai/chat/tools/getEconomy';
import { ECONOMY_CALENDAR_DEFAULT_DAYS } from '@/shared/config/economyCalendar';
import { ECONOMY_RESULT_MAX_CHARS } from '@/app/api/ai/chat/tools/truncate';

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
const HOUR_MS = 60 * 60 * 1000;

function calendarEvent(
    hoursAhead: number,
    event: string,
    impact: 'High' | 'Medium' | 'Low'
) {
    return {
        date: new Date(Date.now() + hoursAhead * HOUR_MS).toISOString(),
        event,
        impact,
        actual: null,
        estimate: null,
        previous: null,
        unit: '%',
    };
}

const EMPTY_SNAPSHOT = { indicators: [], treasury: null, calendar: [] };

interface CalendarResult {
    coverage: { from: string; to: string };
    events: Array<{
        date: string;
        event: string;
        impact: string;
        hoursUntil: number;
    }>;
    omitted: { High: number; Medium: number; Low: number };
}

describe('getEconomyTool', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        freshTreasury.mockResolvedValue(null);
        calendarRange.mockResolvedValue([]);
        vi.useFakeTimers();
        // 2026-09-13 20:00 ET — ET 날짜가 UTC 날짜보다 하루 이르다.
        vi.setSystemTime(new Date('2026-09-14T00:00:00.000Z'));
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('스냅샷이 없으면 available:false, 실패는 오류 이름만 남긴다', async () => {
        const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
        const error = new Error('redis down: secret detail');
        error.name = 'UpstashError';
        snapshot.mockRejectedValue(error);
        const r = await getEconomyTool({}, ctx, rt);
        expect(logged).toHaveBeenCalledWith(
            '[AgentTool]',
            'get_economy',
            'economy snapshot failed, degrading',
            { errorName: 'UpstashError', code: undefined }
        );
        expect(JSON.stringify(logged.mock.calls)).not.toContain('secret');
        logged.mockRestore();
        expect(r).toEqual({
            available: false,
            reason: 'snapshot_unavailable',
            calendar: expect.objectContaining({ events: [] }),
        });
        expect(briefing).not.toHaveBeenCalled();
    });

    it('스냅샷이 없어도 이미 읽은 캘린더는 버리지 않는다', async () => {
        const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
        snapshot.mockRejectedValue(new Error('db down'));
        calendarRange.mockResolvedValue([
            calendarEvent(5 * 24, 'Fed Interest Rate Decision', 'High'),
        ]);
        const r = (await getEconomyTool({}, ctx, rt)) as {
            available: boolean;
            calendar: CalendarResult;
        };
        logged.mockRestore();
        expect(r.available).toBe(false);
        expect(r.calendar.events.map(e => e.event)).toEqual([
            'Fed Interest Rate Decision',
        ]);
    });

    it('인자가 없으면 오늘(ET)부터 기본 창을 읽고, 지난 일정만 빼며 브리핑을 함께 반환한다', async () => {
        snapshot.mockResolvedValue({
            ...EMPTY_SNAPSHOT,
            indicators: [
                {
                    name: 'federalFunds',
                    latest: { date: '2026-09-01', value: 4.5 },
                    previous: { date: '2026-08-01', value: 4.5 },
                    trend: [],
                },
            ],
        });
        calendarRange.mockResolvedValue([
            calendarEvent(3 * 24, 'CPI YoY', 'High'),
            // 예전 7일 창(그 전엔 스냅샷 14일 창) 밖 — 다음 FOMC가 그만큼 남으면 일정이 사라졌다.
            calendarEvent(45 * 24, 'Fed Interest Rate Decision', 'High'),
            calendarEvent(-2, 'Past release', 'Low'),
        ]);
        briefing.mockResolvedValue({
            briefing: {
                summary: '완만한 성장세가 이어지고 있습니다.',
                highlights: [],
                regime: 'expansion',
            },
            generatedAt: '2026-09-13T10:00:00.000Z',
        });

        const r = (await getEconomyTool({}, ctx, rt)) as {
            available: boolean;
            calendar: CalendarResult;
            briefing: { regime: string };
        };
        // 요청 창을 앞뒤 하루씩 넓혀 읽는다 — FMP는 UTC 날짜로 거른다.
        expect(calendarRange).toHaveBeenCalledWith('2026-09-12', '2026-11-23');
        expect(ECONOMY_CALENDAR_DEFAULT_DAYS).toBe(70);
        expect(r.available).toBe(true);
        expect(r.calendar.coverage).toEqual({
            from: '2026-09-13',
            to: '2026-11-22',
        });
        expect(r.calendar.events.map(e => e.event)).toEqual([
            'CPI YoY',
            'Fed Interest Rate Decision',
        ]);
        expect(r.calendar.events[0]!.hoursUntil).toBe(3 * 24);
        expect(r.briefing.regime).toBe('expansion');
        // 시스템 시각 2026-09-14T00:00Z → core와 같은 UTC 날짜 버킷.
        expect(briefing).toHaveBeenCalledWith(expect.anything(), '2026-09-14');
    });

    it('앞선 Low 일정이 상한을 넘게 많아도 금리 결정이 남고, 빠진 건수를 알린다', async () => {
        // 2026-10-23 운영 사례: 오늘 남은 시추기 수·CFTC 포지션만으로 앞 10칸이
        // 차서 5일 뒤 금리 결정이 모델에 닿지 않았다.
        snapshot.mockResolvedValue(EMPTY_SNAPSHOT);
        calendarRange.mockResolvedValue([
            ...Array.from({ length: 100 }, (_, i) =>
                calendarEvent(1 + i, `CFTC position ${i}`, 'Low')
            ),
            calendarEvent(5 * 24, 'Fed Interest Rate Decision', 'High'),
        ]);
        briefing.mockResolvedValue(null);
        const r = (await getEconomyTool({}, ctx, rt)) as {
            calendar: CalendarResult;
        };
        const names = r.calendar.events.map(e => e.event);
        expect(names).toHaveLength(80);
        expect(names).toContain('Fed Interest Rate Decision');
        expect(r.calendar.omitted).toEqual({ High: 0, Medium: 0, Low: 21 });
        const times = r.calendar.events.map(e => Date.parse(e.date));
        expect(times).toEqual([...times].sort((a, b) => a - b));
    });

    it('FMP의 존 표시 없는 UTC 일시를 ISO 인스턴트로 바꿔 지난 일정 필터와 사용자 시간대 변환이 맞게 된다', async () => {
        // 2026-09-15 12:30 UTC = 21:30 KST. 서버 로컬 시간으로 읽히거나 존 없이
        // 넘어가면 모델이 "12:30"을 한국 시각처럼 옮긴다.
        snapshot.mockResolvedValue(EMPTY_SNAPSHOT);
        calendarRange.mockResolvedValue([
            {
                date: '2026-09-15 12:30:00',
                event: 'NY Empire State Manufacturing Index',
                impact: 'High',
                actual: null,
                estimate: 15,
                previous: 20.6,
                unit: '',
            },
            {
                // 현재(2026-09-14T00:00Z) 이전 — 로컬 파싱이면 경계가 흔들린다.
                date: '2026-09-13 23:30:00',
                event: 'Past',
                impact: 'Low',
                actual: 1,
                estimate: 1,
                previous: 1,
                unit: '',
            },
        ]);
        briefing.mockResolvedValue(null);
        const r = (await getEconomyTool({}, ctx, rt)) as {
            calendar: CalendarResult;
        };
        expect(r.calendar.events).toEqual([
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
        snapshot.mockResolvedValue(EMPTY_SNAPSHOT);
        calendarRange.mockResolvedValue([
            {
                date: '2026-09-15T12:30:00Z',
                event: 'Already ISO',
                impact: 'High',
                actual: null,
                estimate: null,
                previous: null,
                unit: '',
            },
        ]);
        briefing.mockResolvedValue(null);
        const r = (await getEconomyTool({}, ctx, rt)) as {
            calendar: CalendarResult;
        };
        expect(r.calendar.events).toEqual([
            expect.objectContaining({ date: '2026-09-15T12:30:00Z' }),
        ]);
    });

    it('브리핑 조회가 실패해도(catch) 스냅샷 나머지 필드는 반환된다', async () => {
        snapshot.mockResolvedValue(EMPTY_SNAPSHOT);
        briefing.mockRejectedValue(new Error('cache miss'));
        const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
        const r = (await getEconomyTool({}, ctx, rt)) as {
            available: boolean;
            briefing: unknown;
        };
        expect(r.available).toBe(true);
        expect(r.briefing).toBeNull();
        expect(logged).toHaveBeenCalledWith(
            '[AgentTool]',
            'get_economy',
            'macro briefing failed, degrading',
            expect.objectContaining({ errorName: 'Error' })
        );
        logged.mockRestore();
    });

    it('캘린더 조회가 실패하면 스냅샷의 캘린더로 물러나고, 좁아진 coverage와 출처를 밝힌다', async () => {
        snapshot.mockResolvedValue({
            ...EMPTY_SNAPSHOT,
            calendar: [
                calendarEvent(-3, 'Already released', 'High'),
                calendarEvent(2 * 24, 'CPI YoY', 'High'),
            ],
        });
        calendarRange.mockRejectedValue(new Error('fmp 429'));
        briefing.mockResolvedValue(null);
        const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
        const r = (await getEconomyTool({}, ctx, rt)) as {
            available: boolean;
            calendar: CalendarResult & { fallback: string };
        };
        expect(r.available).toBe(true);
        expect(r.calendar.events.map(e => e.event)).toEqual(['CPI YoY']);
        // 스냅샷 14일 창이 최대 ~48h 묵을 수 있어 이틀 덜 주장한다.
        expect(r.calendar.coverage).toEqual({
            from: '2026-09-13',
            to: '2026-09-25',
        });
        expect(r.calendar.fallback).toContain('economy snapshot');
        expect(logged).toHaveBeenCalledWith(
            '[AgentTool]',
            'get_economy',
            'economic calendar failed, degrading',
            expect.objectContaining({ errorName: 'Error' })
        );
        logged.mockRestore();
    });

    describe('기간 조회(from/to)', () => {
        it('지정 기간만 읽고, 지난 발표도 남기며, 캘린더만 돌려준다', async () => {
            calendarRange.mockResolvedValue([
                calendarEvent(-10 * 24, 'CPI YoY', 'High'),
                calendarEvent(60 * 24, 'Fed Interest Rate Decision', 'High'),
            ]);
            const r = (await getEconomyTool(
                { from: '2026-09-01', to: '2026-11-27' },
                ctx,
                rt
            )) as Record<string, unknown> & { calendar: CalendarResult };
            expect(calendarRange).toHaveBeenCalledWith(
                '2026-08-31',
                '2026-11-28'
            );
            expect(snapshot).not.toHaveBeenCalled();
            expect(Object.keys(r).sort()).toEqual([
                'asOf',
                'available',
                'calendar',
                'source',
            ]);
            expect(r.calendar.coverage).toEqual({
                from: '2026-09-01',
                to: '2026-11-27',
            });
            expect(r.calendar.events.map(e => e.event)).toEqual([
                'CPI YoY',
                'Fed Interest Rate Decision',
            ]);
            expect(r.calendar.events[0]!.hoursUntil).toBe(-10 * 24);
        });

        it('조회가 실패하면 calendar_unavailable', async () => {
            calendarRange.mockRejectedValue(new Error('fmp down'));
            const logged = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            const r = await getEconomyTool(
                { from: '2026-12-01', to: '2026-12-31' },
                ctx,
                rt
            );
            logged.mockRestore();
            expect(r).toEqual({
                available: false,
                reason: 'calendar_unavailable',
            });
        });

        it.each([
            [{ from: '2026-12-01' }, ['to']],
            [{ to: '2026-12-01' }, ['from']],
            [{ from: '2026/12/01', to: '2026-12-31' }, ['from']],
            [{ from: '2026-02-30', to: '2026-03-31' }, ['from']],
            [{ from: '2026-12-31', to: '2026-12-01' }, ['to']],
            // 89일 — 앞뒤 하루씩 넓혀 읽으면 FMP가 `to`로부터 돌려주는 90일을 넘는다.
            [{ from: '2026-01-01', to: '2026-03-31' }, ['to']],
            // 오늘(2026-09-13 ET)에서 2년 넘게 과거, 1년 넘게 미래
            [{ from: '2024-09-12', to: '2024-10-01' }, ['from']],
            [{ from: '2027-09-01', to: '2027-09-14' }, ['to']],
        ])(
            '잘못된 인자 %o는 FMP를 부르지 않고 invalid_args',
            async (args, paths) => {
                const r = (await getEconomyTool(args, ctx, rt)) as {
                    error: string;
                    issues: Array<{ path: string }>;
                };
                expect(r.error).toBe('invalid_args');
                expect(r.issues.map(i => i.path)).toEqual(paths);
                expect(calendarRange).not.toHaveBeenCalled();
            }
        );

        it('정확히 88일 범위는 허용하고, 앞뒤 하루를 넓힌 90일을 읽는다', async () => {
            const r = (await getEconomyTool(
                { from: '2026-01-01', to: '2026-03-30' },
                ctx,
                rt
            )) as { available?: boolean };
            expect(r.available).toBe(true);
            expect(calendarRange).toHaveBeenCalledWith(
                '2025-12-31',
                '2026-03-31'
            );
        });

        it('KST 날짜로 물어도 그날 새벽의 FOMC(UTC 전날 18:00)가 잡힌다', async () => {
            // 2026-10-29 03:00 KST = 2026-10-28 18:00 UTC. FMP는 UTC 날짜로 거르므로
            // from=to=10-29만 읽으면 빠진다.
            calendarRange.mockImplementation(async (from: string) =>
                from <= '2026-10-28'
                    ? [
                          {
                              date: '2026-10-28 18:00:00',
                              event: 'Fed Interest Rate Decision',
                              impact: 'High',
                              actual: null,
                              estimate: null,
                              previous: null,
                              unit: '%',
                          },
                      ]
                    : []
            );
            const r = (await getEconomyTool(
                { from: '2026-10-29', to: '2026-10-29' },
                ctx,
                rt
            )) as { calendar: CalendarResult };
            expect(r.calendar.events.map(e => e.event)).toEqual([
                'Fed Interest Rate Decision',
            ]);
        });

        it('기간 조회는 날짜를 읽을 수 없는 행을 버린다', async () => {
            calendarRange.mockResolvedValue([
                {
                    date: 'not a date',
                    event: 'Broken',
                    impact: 'High',
                    actual: null,
                    estimate: null,
                    previous: null,
                    unit: '%',
                },
                calendarEvent(24, 'CPI YoY', 'High'),
            ]);
            const r = (await getEconomyTool(
                { from: '2026-09-13', to: '2026-09-20' },
                ctx,
                rt
            )) as { calendar: CalendarResult };
            expect(r.calendar.events.map(e => e.event)).toEqual(['CPI YoY']);
        });
    });

    it('상한까지 채운 기본 결과가 get_economy 전용 응답 상한 안에 들어간다', async () => {
        // 실측보다 긴 이벤트명·숫자로 만든 최악 픽스처(실측 ~160자/건).
        const longName = 'Durable Goods Orders Ex Defense MoM (Sep) — Rev.';
        snapshot.mockResolvedValue({
            indicators: Array.from({ length: 9 }, (_, i) => ({
                name: `indicator${i}`,
                unit: '%',
                latest: { date: '2026-09-01', value: 1234.56 },
                previous: { date: '2026-08-01', value: 1230.12 },
                trend: [],
            })),
            treasury: { date: '2026-09-12', year2: 3.91, year10: 4.12 },
            calendar: [],
        });
        calendarRange.mockResolvedValue(
            Array.from({ length: 80 }, (_, i) => ({
                ...calendarEvent(1 + i * 10, `${longName} ${i}`, 'High'),
                actual: -12345.67,
                estimate: -12345.67,
                previous: -12345.67,
            }))
        );
        briefing.mockResolvedValue({
            briefing: {
                summary: '가'.repeat(600),
                highlights: [],
                regime: 'expansion',
            },
            generatedAt: '2026-09-13T10:00:00.000Z',
        });
        const r = await getEconomyTool({}, ctx, rt);
        expect(JSON.stringify(r).length).toBeLessThan(ECONOMY_RESULT_MAX_CHARS);
    });

    describe('indicator change/direction, treasury spread', () => {
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

        it('국채는 스냅샷(최대 ~48h)보다 따로 읽은 당일 값(짧은 TTL)을 쓰고, 기준일·읽은 시각을 싣는다', async () => {
            // 실측: 스냅샷은 10/19 값인데 10/21 공표가 이미 나와 있었다.
            snapshot.mockResolvedValue({
                indicators: [],
                treasury: { date: '2026-10-19', year2: 3.6, year10: 5.15 },
                calendar: [],
            });
            freshTreasury.mockResolvedValue({
                treasury: { date: '2026-10-21', year2: 3.62, year10: 5.13 },
                fetchedAt: '2026-10-22T12:00:00.000Z',
                source: 'us-treasury',
                officialAvailable: true,
            });
            briefing.mockResolvedValue(null);
            const r = (await getEconomyTool({}, ctx, rt)) as {
                treasury: Record<string, unknown>;
            };
            expect(r.treasury).toMatchObject({
                date: '2026-10-21',
                year10: 5.13,
                fetchedAt: '2026-10-22T12:00:00.000Z',
                provider: 'US Treasury',
                cache: 'treasury rates (3h cache)',
            });
        });

        it('당일 읽기가 재무부를 못 읽어 FMP로 물러난 값이면 그렇다고 표시한다', async () => {
            snapshot.mockResolvedValue({
                indicators: [],
                treasury: { date: '2026-10-19', year2: 3.6, year10: 5.15 },
                calendar: [],
            });
            freshTreasury.mockResolvedValue({
                treasury: { date: '2026-10-20', year2: 4.79, year10: 5.12 },
                fetchedAt: '2026-10-22T12:00:00.000Z',
                source: 'fmp',
                officialAvailable: false,
            });
            briefing.mockResolvedValue(null);
            const r = (await getEconomyTool({}, ctx, rt)) as {
                treasury: Record<string, unknown>;
            };
            expect(r.treasury).toMatchObject({
                date: '2026-10-20',
                provider: 'FMP',
                cache: expect.stringContaining(
                    'FMP fallback (US Treasury unavailable; 15-min cache'
                ),
            });
        });

        it('당일 읽기가 실패하면 스냅샷 값으로 물러나고, 묵었을 수 있다고 표시한다', async () => {
            snapshot.mockResolvedValue({
                indicators: [],
                treasury: { date: '2026-10-19', year2: 3.6, year10: 5.15 },
                calendar: [],
            });
            briefing.mockResolvedValue(null);
            const r = (await getEconomyTool({}, ctx, rt)) as {
                treasury: Record<string, unknown>;
            };
            expect(r.treasury).toMatchObject({
                date: '2026-10-19',
                fetchedAt: null,
                cache: 'economy snapshot (up to ~48h old)',
            });
        });

        it('따로 읽은 값이 스냅샷보다 오래됐으면 스냅샷 값을 쓰고 fetchedAt은 null', async () => {
            snapshot.mockResolvedValue({
                indicators: [],
                treasury: { date: '2026-10-21', year2: 3.62, year10: 5.13 },
                calendar: [],
            });
            freshTreasury.mockResolvedValue({
                treasury: { date: '2026-10-19', year2: 3.6, year10: 5.15 },
                fetchedAt: '2026-10-22T12:00:00.000Z',
                source: 'fmp',
                officialAvailable: true,
            });
            briefing.mockResolvedValue(null);
            const r = (await getEconomyTool({}, ctx, rt)) as {
                treasury: Record<string, unknown>;
            };
            expect(r.treasury).toMatchObject({
                date: '2026-10-21',
                year10: 5.13,
                fetchedAt: null,
                cache: 'economy snapshot (up to ~48h old)',
            });
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
    });
});
