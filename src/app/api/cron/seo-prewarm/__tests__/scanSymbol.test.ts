import {
    US_EQUITY_SESSION,
    type Bar,
    type ConfirmedSignalDay,
    type MarketDataProvider,
    type SignalType,
} from '@y0ngha/siglens-core';
import { KR_EQUITY_SESSION } from '@/shared/api/market/sessionSpecFor';
import { SIGNAL_SCAN_RELABEL_CUTOVER } from '@/entities/signal-history/lib/signalScanConstants';
import type {
    OpenEpisode,
    ScanCursor,
    SymbolScanWrite,
} from '@/entities/signal-history/types';
import { addUtcIsoDays } from '@/shared/lib/isoDate';
import {
    scanSymbol,
    type ConfirmedSignalTimeline,
    type ScanSymbolContext,
} from '../scanSymbol';

const NOW = new Date('2026-11-13T21:20:00.000Z');
const SESSION = '2026-11-13';

const isWeekday = (date: string): boolean => {
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
    return dow !== 0 && dow !== 6;
};

/** `endDate`까지 평일마다 하나씩 `count`개 봉. `time`은 세션 날짜의 UTC 자정(공급자 규약). */
function barsEndingOn(endDate: string, count: number): Bar[] {
    const dates = Array.from({ length: count * 2 + 10 }, (_, i) =>
        addUtcIsoDays(endDate, -i)
    )
        .filter(isWeekday)
        .slice(0, count)
        .toReversed();
    return dates.map((date, i) => ({
        time: Date.parse(`${date}T00:00:00Z`) / 1000,
        open: 100 + i,
        high: 101 + i,
        low: 99 + i,
        close: 100 + i,
        volume: 1_000,
    }));
}

const dateOf = (bar: Bar): string =>
    new Date(bar.time * 1000).toISOString().slice(0, 10);

type Table = ReadonlyMap<string, string>;

/** `applySymbolScan`·`openEpisodesSince`·`recordScanFailure`를 메모리 표로 받는 가짜 저장소. */
function memoryRepo(initial: Table = new Map()) {
    const state = { rows: initial, writes: [] as SymbolScanWrite[] };
    return {
        state,
        repo: {
            openEpisodesSince: vi.fn(
                async (
                    _market: string,
                    _symbol: string,
                    since: string
                ): Promise<OpenEpisode[]> =>
                    [...state.rows]
                        .filter(([, lastSeen]) => lastSeen >= since)
                        .map(([key, lastSeen]) => {
                            const [signalType = '', sessionDate = ''] =
                                key.split('|');
                            return {
                                signalType,
                                sessionDate,
                                lastSeenSession: lastSeen,
                            };
                        })
            ),
            applySymbolScan: vi.fn(async (write: SymbolScanWrite) => {
                state.writes = [...state.writes, write];
                state.rows = new Map([
                    ...write.inserts.map(
                        row =>
                            [
                                `${row.signalType}|${row.sessionDate}`,
                                row.lastSeenSession,
                            ] as const
                    ),
                    ...[...state.rows].map(([key, lastSeen]) => {
                        const update = write.lastSeenUpdates.find(
                            u => `${u.signalType}|${u.sessionDate}` === key
                        );
                        return [
                            key,
                            update?.lastSeenSession ?? lastSeen,
                        ] as const;
                    }),
                ]);
            }),
            recordScanFailure: vi.fn(async () => {}),
        },
    };
}

/** 날짜별로 정해진 신호를 돌려주는 가짜 타임라인. */
function fakeTimeline(
    signalsOn: (date: string) => readonly SignalType[] | null
): ConfirmedSignalTimeline {
    return vi.fn(
        (
            bars: readonly Bar[],
            { days }: { days: number }
        ): readonly ConfirmedSignalDay[] =>
            bars.slice(-days).map(bar => {
                const types = signalsOn(dateOf(bar));
                return {
                    time: bar.time,
                    close: bar.close,
                    changePercent: 1,
                    signals:
                        types === null
                            ? null
                            : types.map(type => ({
                                  type,
                                  phase: 'confirmed' as const,
                                  direction: 'bullish' as const,
                                  detectedAt: bar.time,
                              })),
                };
            })
    ) as ConfirmedSignalTimeline;
}

function setup(
    bars: Bar[],
    overrides: Partial<ScanSymbolContext> & {
        signalsOn?: (date: string) => readonly SignalType[] | null;
    } = {}
) {
    const { signalsOn = () => ['golden_cross'], ...contextOverrides } =
        overrides;
    const memory = memoryRepo();
    const provider: MarketDataProvider = {
        getBars: vi.fn(async () => bars),
        getQuote: vi.fn(async () => null),
    };
    const yieldToEventLoop = vi.fn(async () => {});
    const timeline = fakeTimeline(signalsOn);
    const ctx: ScanSymbolContext = {
        repo: memory.repo,
        provider,
        spec: US_EQUITY_SESSION,
        timeline,
        yieldToEventLoop,
        market: 'us',
        session: SESSION,
        now: NOW,
        ...contextOverrides,
    };
    return { ctx, memory, provider, timeline, yieldToEventLoop };
}

const CURSOR_YESTERDAY: ScanCursor = {
    lastSession: '2026-11-12',
    attemptSession: null,
    attempts: 0,
    lastOutcome: 'recorded',
};

const target = (cursor: ScanCursor | undefined) => ({
    symbol: 'NVDA',
    koreanName: null,
    cursor,
});

beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('scanSymbol — normal', () => {
    it('하루만 판정하고, 직전 세션 이후 이어진 행을 조회해, 한 번의 쓰기로 반영한다', async () => {
        const { ctx, memory, timeline } = setup(barsEndingOn(SESSION, 300));

        const result = await scanSymbol(ctx, target(CURSOR_YESTERDAY));

        expect(result).toEqual({
            outcome: 'recorded',
            mode: 'normal',
            latestUnknown: false,
        });
        expect(timeline).toHaveBeenCalledTimes(1);
        expect(vi.mocked(timeline).mock.calls.map(([, o]) => o.days)).toEqual([
            1,
        ]);
        expect(memory.repo.openEpisodesSince).toHaveBeenCalledWith(
            'us',
            'NVDA',
            '2026-11-12',
            undefined
        );
        expect(memory.state.writes).toHaveLength(1);
        expect(memory.state.writes[0]).toMatchObject({
            market: 'us',
            symbol: 'NVDA',
            session: SESSION,
            rebuildFrom: null,
            relabelCutover: null,
        });
        expect(memory.state.writes[0]?.inserts).toHaveLength(1);
    });

    it('봉은 스캐너 창(400일) + 판정 일수 + 여유만큼 거슬러 받는다', async () => {
        const { ctx, provider } = setup(barsEndingOn(SESSION, 300));

        await scanSymbol(ctx, target(CURSOR_YESTERDAY));

        // 400 + ceil(1 * 7/5) + 10 = 412일 전
        expect(provider.getBars).toHaveBeenCalledWith({
            symbol: 'NVDA',
            timeframe: '1Day',
            from: addUtcIsoDays('2026-11-13', -412),
        });
    });

    it('한국 달력과 시장 값으로도 같다 — 일봉 시각은 세션 날짜의 UTC 자정이다', async () => {
        const bars = barsEndingOn(SESSION, 300);
        const { ctx, memory } = setup(bars, {
            market: 'kr',
            spec: KR_EQUITY_SESSION,
        });

        await scanSymbol(ctx, {
            symbol: '005930.KS',
            koreanName: '삼성전자',
            cursor: CURSOR_YESTERDAY,
        });

        expect(memory.state.writes[0]).toMatchObject({
            market: 'kr',
            symbol: '005930.KS',
            session: SESSION,
        });
        expect(memory.state.writes[0]?.inserts[0]).toMatchObject({
            koreanName: '삼성전자',
        });
    });
});

describe('scanSymbol — bootstrap', () => {
    it('표식이 없으면 120일을 10일씩 끊어 판정하고 구간 사이에 양보한다', async () => {
        const bars = barsEndingOn(SESSION, 300);
        const { ctx, memory, timeline, yieldToEventLoop } = setup(bars);

        const result = await scanSymbol(ctx, target(undefined));

        expect(result).toEqual({
            outcome: 'recorded',
            mode: 'bootstrap',
            latestUnknown: false,
        });
        const calls = vi.mocked(timeline).mock.calls;
        expect(calls.map(([, o]) => o.days)).toEqual(Array(12).fill(10));
        // 각 구간은 그 구간 끝까지의 봉만 받는다(미래 봉을 보지 않는다).
        expect(calls.map(([b]) => b.length)).toEqual(
            Array.from({ length: 12 }, (_, i) => 300 - 120 + 10 * (i + 1))
        );
        expect(yieldToEventLoop).toHaveBeenCalledTimes(11);
        expect(memory.state.writes).toHaveLength(1);
    });

    it('이름 바꾸기 기준 시각을 조회와 쓰기 두 곳에 같은 상수로 넘긴다', async () => {
        const bars = barsEndingOn(SESSION, 300);
        const { ctx, memory } = setup(bars);

        await scanSymbol(ctx, target(undefined));

        const dates = bars.map(dateOf);
        const firstDay = dates[300 - 120] ?? '';
        expect(memory.repo.openEpisodesSince).toHaveBeenCalledWith(
            'us',
            'NVDA',
            dates[300 - 121],
            { relabelCutover: SIGNAL_SCAN_RELABEL_CUTOVER }
        );
        expect(memory.state.writes[0]).toMatchObject({
            rebuildFrom: firstDay,
            relabelCutover: SIGNAL_SCAN_RELABEL_CUTOVER,
        });
    });

    it('봉이 120개보다 적은 신규 상장 종목은 있는 만큼 판정한다', async () => {
        const { ctx, timeline } = setup(barsEndingOn(SESSION, 35));

        await scanSymbol(ctx, target(undefined));

        expect(vi.mocked(timeline).mock.calls.map(([, o]) => o.days)).toEqual([
            10, 10, 10, 5,
        ]);
    });

    it('봉은 한 번만 받는다(구간마다 다시 받지 않는다)', async () => {
        const { ctx, provider } = setup(barsEndingOn(SESSION, 300));

        await scanSymbol(ctx, target(undefined));

        expect(provider.getBars).toHaveBeenCalledTimes(1);
        // 400 + ceil(120 * 7/5) + 10 = 578일 전
        expect(provider.getBars).toHaveBeenCalledWith(
            expect.objectContaining({
                from: addUtcIsoDays('2026-11-13', -578),
            })
        );
    });
});

describe('scanSymbol — catch up', () => {
    const bars = barsEndingOn(SESSION, 300);
    const signalsOn = (date: string): readonly SignalType[] =>
        date >= '2026-11-10' && date <= '2026-11-12'
            ? ['rsi_oversold']
            : date === '2026-11-13'
              ? ['rsi_oversold', 'macd_bullish_cross']
              : [];

    it('2세션을 놓친 뒤 따라잡은 결과는 하루씩 두 번 기록한 결과와 같다', async () => {
        const gap: ScanCursor = {
            ...CURSOR_YESTERDAY,
            lastSession: '2026-11-11',
        };
        const seed: Table = new Map([
            ['rsi_oversold|2026-11-10', '2026-11-11'],
        ]);

        const caughtUp = setup(bars, { signalsOn });
        caughtUp.memory.state.rows = seed;
        const caughtUpResult = await scanSymbol(caughtUp.ctx, target(gap));

        const stepwise = setup(
            bars.filter(b => dateOf(b) <= '2026-11-12'),
            {
                signalsOn,
                session: '2026-11-12',
            }
        );
        stepwise.memory.state.rows = seed;
        await scanSymbol(stepwise.ctx, {
            ...target({ ...gap, lastSession: '2026-11-11' }),
        });
        const second = setup(bars, { signalsOn });
        second.memory.state.rows = stepwise.memory.state.rows;
        await scanSymbol(
            second.ctx,
            target({ ...gap, lastSession: '2026-11-12' })
        );

        expect(caughtUpResult).toEqual({
            outcome: 'recorded',
            mode: 'catch_up',
            latestUnknown: false,
        });
        expect([...caughtUp.memory.state.rows].toSorted()).toEqual(
            [...second.memory.state.rows].toSorted()
        );
        expect(caughtUp.memory.state.rows.get('rsi_oversold|2026-11-10')).toBe(
            '2026-11-13'
        );
    });

    it('놓친 세션만큼만 판정한다', async () => {
        const gap: ScanCursor = {
            ...CURSOR_YESTERDAY,
            lastSession: '2026-11-10',
        };
        const { ctx, timeline } = setup(bars, { signalsOn });

        await scanSymbol(ctx, target(gap));

        expect(vi.mocked(timeline).mock.calls.map(([, o]) => o.days)).toEqual([
            3,
        ]);
        expect(ctx.repo.openEpisodesSince).toHaveBeenCalledWith(
            'us',
            'NVDA',
            '2026-11-10',
            undefined
        );
    });
});

describe('scanSymbol — 판정 불가·실패', () => {
    it('판정할 수 없는 날(signals null)은 이어지던 에피소드를 열어 둔 채 마지막 포착 세션을 늘린다', async () => {
        const { ctx, memory } = setup(barsEndingOn(SESSION, 300), {
            signalsOn: () => null,
        });
        memory.state.rows = new Map([
            ['rsi_oversold|2026-11-05', '2026-11-12'],
        ]);

        await scanSymbol(ctx, target(CURSOR_YESTERDAY));

        expect(memory.state.writes[0]?.inserts).toEqual([]);
        expect(memory.state.writes[0]?.lastSeenUpdates).toEqual([
            {
                signalType: 'rsi_oversold',
                sessionDate: '2026-11-05',
                lastSeenSession: SESSION,
            },
        ]);
    });

    it('마지막 봉이 이번 세션이 아니면 stale 시도로 세고 아무것도 쓰지 않는다', async () => {
        const { ctx, memory } = setup(barsEndingOn('2026-11-12', 300));

        const result = await scanSymbol(ctx, target(CURSOR_YESTERDAY));

        expect(result).toEqual({ outcome: 'stale', persisted: true });
        expect(memory.repo.recordScanFailure).toHaveBeenCalledWith(
            'us',
            'NVDA',
            SESSION,
            'stale'
        );
        expect(memory.repo.applySymbolScan).not.toHaveBeenCalled();
    });

    it('봉이 하나도 없어도 stale이다', async () => {
        const { ctx, memory } = setup([]);

        await expect(scanSymbol(ctx, target(undefined))).resolves.toEqual({
            outcome: 'stale',
            persisted: true,
        });
        expect(memory.repo.applySymbolScan).not.toHaveBeenCalled();
    });

    it('봉 조회가 거절되면 던지지 않고 failed 시도로 센다', async () => {
        const { ctx, memory, provider } = setup([]);
        vi.mocked(provider.getBars).mockRejectedValue(new Error('429'));

        const result = await scanSymbol(ctx, target(CURSOR_YESTERDAY));

        expect(result).toEqual({ outcome: 'failed', persisted: true });
        expect(memory.repo.recordScanFailure).toHaveBeenCalledWith(
            'us',
            'NVDA',
            SESSION,
            'failed'
        );
    });

    it('쓰기가 실패하면 failed다', async () => {
        const { ctx, memory } = setup(barsEndingOn(SESSION, 300));
        memory.repo.applySymbolScan.mockRejectedValue(new Error('db down'));

        await expect(
            scanSymbol(ctx, target(CURSOR_YESTERDAY))
        ).resolves.toEqual({ outcome: 'failed', persisted: true });
        expect(memory.repo.recordScanFailure).toHaveBeenCalledWith(
            'us',
            'NVDA',
            SESSION,
            'failed'
        );
    });

    it('시도를 기록하는 쓰기까지 실패해도 던지지 않고, 써지지 않았음(persisted false)을 알린다', async () => {
        const { ctx, memory, provider } = setup([]);
        vi.mocked(provider.getBars).mockRejectedValue(new Error('429'));
        memory.repo.recordScanFailure.mockRejectedValue(new Error('db down'));

        await expect(
            scanSymbol(ctx, target(CURSOR_YESTERDAY))
        ).resolves.toEqual({ outcome: 'failed', persisted: false });
    });

    it('낡은 데이터의 시도 기록이 실패해도 persisted false다', async () => {
        const { ctx, memory } = setup(barsEndingOn('2026-11-12', 300));
        memory.repo.recordScanFailure.mockRejectedValue(new Error('db down'));

        await expect(
            scanSymbol(ctx, target(CURSOR_YESTERDAY))
        ).resolves.toEqual({ outcome: 'stale', persisted: false });
    });

    it('마지막 날의 판정이 불가면 recorded에 latestUnknown을 표시한다', async () => {
        const { ctx } = setup(barsEndingOn(SESSION, 300), {
            signalsOn: () => null,
        });

        await expect(
            scanSymbol(ctx, target(CURSOR_YESTERDAY))
        ).resolves.toEqual({
            outcome: 'recorded',
            mode: 'normal',
            latestUnknown: true,
        });
    });
});
