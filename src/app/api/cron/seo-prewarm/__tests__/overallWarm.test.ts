/**
 * 종합 사전 생성 단계(`runOverallWarmStep`)의 분기별 가드. 달력은 `now` 인자, 경과 시간은 주입한 시계로
 * 고정한다 — 실제 `Date.now()`에 기대지 않는다.
 */
const {
    mockClaimOverallWarm,
    mockIsOverallWarmClaimed,
    mockAddOverallWarmPending,
    mockListOverallWarmPending,
    mockRemoveOverallWarmPending,
    mockBumpOverallWarmPendingChecks,
    mockGetOverallWarmStartsToday,
    mockIncrementOverallWarmStartsToday,
    mockHasPrewarmedOverall,
    mockAddFmpBudget,
    mockOverall,
    mockGetAssetInfoResilient,
    mockRevalidateTag,
} = vi.hoisted(() => ({
    mockClaimOverallWarm: vi.fn(),
    mockIsOverallWarmClaimed: vi.fn(),
    mockAddOverallWarmPending: vi.fn(),
    mockListOverallWarmPending: vi.fn(),
    mockRemoveOverallWarmPending: vi.fn(),
    mockBumpOverallWarmPendingChecks: vi.fn(),
    mockGetOverallWarmStartsToday: vi.fn(),
    mockIncrementOverallWarmStartsToday: vi.fn(),
    mockHasPrewarmedOverall: vi.fn(),
    mockAddFmpBudget: vi.fn(),
    mockOverall: vi.fn(),
    mockGetAssetInfoResilient: vi.fn(),
    mockRevalidateTag: vi.fn(),
}));

vi.mock('../lock', () => ({
    claimOverallWarm: mockClaimOverallWarm,
    isOverallWarmClaimed: mockIsOverallWarmClaimed,
    addOverallWarmPending: mockAddOverallWarmPending,
    listOverallWarmPending: mockListOverallWarmPending,
    removeOverallWarmPending: mockRemoveOverallWarmPending,
    bumpOverallWarmPendingChecks: mockBumpOverallWarmPendingChecks,
    getOverallWarmStartsToday: mockGetOverallWarmStartsToday,
    incrementOverallWarmStartsToday: mockIncrementOverallWarmStartsToday,
    addFmpBudget: mockAddFmpBudget,
}));
vi.mock('@/entities/analysis/api', () => ({
    hasPrewarmedOverall: mockHasPrewarmedOverall,
}));
vi.mock('../harvest', () => ({ TAB_SEAMS: { overall: mockOverall } }));
vi.mock('@/entities/ticker/server/getAssetInfoResilient', () => ({
    getAssetInfoResilient: mockGetAssetInfoResilient,
}));
vi.mock('next/cache', () => ({ revalidateTag: mockRevalidateTag }));

import type { OverallWarmPendingEntry } from '../lock';
import {
    OVERALL_WARM_MAX_PER_TICK,
    OVERALL_WARM_MAX_STARTS_PER_UTC_DAY,
    OVERALL_WARM_PENDING_MAX_AGE_MS,
    OVERALL_WARM_PENDING_MAX_CHECKS,
    OVERALL_WARM_TAIL_RESERVE_MS,
    OVERALL_WARM_TIMEOUT_MS,
    runOverallWarmStep,
    type OverallWarmCounts,
    type OverallWarmInput,
} from '../overallWarm';

// 2026-11-20(금) 22:00 UTC — EST 마감(21:00 UTC)+버퍼가 지나 경계는 그 날 21:00 UTC. 정규장은 닫혀 있다.
const NOW_FRI = new Date('2026-11-20T22:00:00.000Z');
const FRI_CLOSE_BOUNDARY_MS = Date.parse('2026-11-20T21:00:00.000Z');
const START_MS = 1_000_000;
const WALL_CLOCK_END_MS = START_MS + 840_000;
const LAST_START_MS =
    WALL_CLOCK_END_MS - OVERALL_WARM_TAIL_RESERVE_MS - OVERALL_WARM_TIMEOUT_MS;

interface ClockState {
    nowMs: number;
    /** true면 `sleep`이 즉시 끝난다(유닛 타임아웃 재현). */
    expireSleep: boolean;
}

function freshCounts(): OverallWarmCounts {
    return {
        overallWarmed: 0,
        overallWarmSkippedByBudget: 0,
        overallWarmSkippedByBacklog: 0,
        overallWarmSkippedByDailyCap: 0,
        overallWarmTimedOut: 0,
        overallWarmFailed: 0,
        overallWarmPendingRevalidated: 0,
    };
}

function makeInput(
    state: ClockState,
    overrides: Partial<OverallWarmInput> = {}
): OverallWarmInput {
    return {
        symbols: ['HOT'],
        now: NOW_FRI,
        clock: {
            now: () => state.nowMs,
            sleep: () =>
                state.expireSleep
                    ? Promise.resolve()
                    : new Promise<void>(() => {}),
        },
        wallClockEndMs: WALL_CLOCK_END_MS,
        hasBacklog: false,
        isTechnicalFresh: () => true,
        fmpCallsPerTab: () => 3,
        counts: freshCounts(),
        ...overrides,
    };
}

function newState(nowMs: number = START_MS): ClockState {
    return { nowMs, expireSleep: false };
}

function pending(
    symbol: string,
    startedAtMs: number,
    checks: number
): OverallWarmPendingEntry {
    return {
        symbol,
        startedAtMs,
        checks,
        member: `${symbol}|${startedAtMs}|${checks}`,
    };
}

function messages(spy: { mock: { calls: unknown[][] } }): string[] {
    return spy.mock.calls.map(([message]) => String(message));
}

describe('runOverallWarmStep', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockClaimOverallWarm.mockResolvedValue(true);
        mockIsOverallWarmClaimed.mockResolvedValue(false);
        mockListOverallWarmPending.mockResolvedValue([]);
        mockGetOverallWarmStartsToday.mockResolvedValue(0);
        mockHasPrewarmedOverall.mockResolvedValue(true);
        mockAddFmpBudget.mockResolvedValue(0);
        mockOverall.mockResolvedValue({ status: 'done', result: {} });
        mockGetAssetInfoResilient.mockImplementation(
            async (symbol: string) => ({
                assetInfo: {
                    symbol,
                    name: `${symbol} Inc.`,
                    fmpSymbol: undefined,
                },
                degraded: false,
            })
        );
    });

    it('대상이 비면 claim도 core도 건드리지 않는다(대기 목록 확인은 한다)', async () => {
        const input = makeInput(newState(), { symbols: [] });

        await runOverallWarmStep(input);

        expect(mockListOverallWarmPending).toHaveBeenCalledTimes(1);
        expect(mockIsOverallWarmClaimed).not.toHaveBeenCalled();
        expect(mockOverall).not.toHaveBeenCalled();
    });

    it('시작 가능하면 claim하고 만든 뒤 태그를 털고 FMP 예산을 더한다', async () => {
        const input = makeInput(newState());

        await runOverallWarmStep(input);

        expect(mockClaimOverallWarm).toHaveBeenCalledWith(
            'HOT',
            FRI_CLOSE_BOUNDARY_MS,
            expect.any(Number)
        );
        expect(mockOverall).toHaveBeenCalledWith({
            symbol: 'HOT',
            companyName: 'HOT Inc.',
            fmpSymbol: undefined,
        });
        expect(mockRevalidateTag).toHaveBeenCalledWith(
            'overall-peek:HOT',
            'max'
        );
        expect(mockAddFmpBudget).toHaveBeenCalledWith(3);
        expect(input.counts.overallWarmed).toBe(1);
    });

    it('technical이 fresh가 아니면 claim도 만들기도 하지 않는다', async () => {
        const input = makeInput(newState(), { isTechnicalFresh: () => false });

        await runOverallWarmStep(input);

        expect(mockIsOverallWarmClaimed).not.toHaveBeenCalled();
        expect(mockClaimOverallWarm).not.toHaveBeenCalled();
        expect(mockOverall).not.toHaveBeenCalled();
    });

    it('국내 종목은 KRX 장중에는 미룬다(claim도 안 잡는다)', async () => {
        // 2026-11-18(수) 03:00 UTC = 12:00 KST, KRX 정규장 중.
        const input = makeInput(newState(), {
            symbols: ['005930.KS'],
            now: new Date('2026-11-18T03:00:00.000Z'),
        });

        await runOverallWarmStep(input);

        expect(mockClaimOverallWarm).not.toHaveBeenCalled();
        expect(mockOverall).not.toHaveBeenCalled();
    });

    describe('경계당 한 번', () => {
        it('이미 시도한 심볼(claim 있음)은 만들지 않고 예산 부족으로도 세지 않는다', async () => {
            mockIsOverallWarmClaimed.mockResolvedValue(true);
            const input = makeInput(newState(LAST_START_MS + 1));

            await runOverallWarmStep(input);

            expect(mockClaimOverallWarm).not.toHaveBeenCalled();
            expect(mockOverall).not.toHaveBeenCalled();
            expect(input.counts.overallWarmSkippedByBudget).toBe(0);
        });

        it('peek 뒤 claim 경쟁에서 지면(false) 만들지 않는다', async () => {
            mockClaimOverallWarm.mockResolvedValue(false);
            const input = makeInput(newState());

            await runOverallWarmStep(input);

            expect(mockOverall).not.toHaveBeenCalled();
            expect(input.counts.overallWarmed).toBe(0);
        });
    });

    describe('시간 예산', () => {
        it('시작 한도(락 획득 후 470초) 정각이면 시작한다', async () => {
            const input = makeInput(newState(LAST_START_MS));

            await runOverallWarmStep(input);

            expect(mockOverall).toHaveBeenCalledTimes(1);
            expect(input.counts.overallWarmSkippedByBudget).toBe(0);
        });

        it('한도를 1ms라도 넘기면 claim 없이 건너뛰고 센다', async () => {
            const input = makeInput(newState(LAST_START_MS + 1));

            await runOverallWarmStep(input);

            expect(mockClaimOverallWarm).not.toHaveBeenCalled();
            expect(mockOverall).not.toHaveBeenCalled();
            expect(input.counts.overallWarmSkippedByBudget).toBe(1);
        });

        it('건너뛴 심볼은 claim이 없어서 이후 tick(예산이 넉넉한 시계)에 만든다', async () => {
            const late = makeInput(newState(LAST_START_MS + 1));
            await runOverallWarmStep(late);
            expect(mockOverall).not.toHaveBeenCalled();

            const later = makeInput(newState(START_MS));
            await runOverallWarmStep(later);

            expect(mockClaimOverallWarm).toHaveBeenCalledTimes(1);
            expect(mockOverall).toHaveBeenCalledTimes(1);
            expect(later.counts.overallWarmed).toBe(1);
        });

        it('심볼마다 센다 — 시작 가능한 심볼이 없으면 대상 전부가 건너뜀이다', async () => {
            const input = makeInput(newState(LAST_START_MS + 1), {
                symbols: ['A', 'B', 'C'],
            });

            await runOverallWarmStep(input);

            expect(input.counts.overallWarmSkippedByBudget).toBe(3);
        });
    });

    describe('tick당 상한', () => {
        it('시작한 수가 OVERALL_WARM_MAX_PER_TICK에 닿으면 멈춘다', async () => {
            const symbols = Array.from({ length: 8 }, (_, i) => `S${i}`);
            const input = makeInput(newState(), { symbols });

            await runOverallWarmStep(input);

            expect(mockOverall).toHaveBeenCalledTimes(
                OVERALL_WARM_MAX_PER_TICK
            );
            expect(input.counts.overallWarmed).toBe(OVERALL_WARM_MAX_PER_TICK);
        });

        it('건너뛴 심볼(technical 미fresh)은 상한에 들지 않는다', async () => {
            const symbols = Array.from({ length: 8 }, (_, i) => `S${i}`);
            const input = makeInput(newState(), {
                symbols,
                isTechnicalFresh: symbol => symbol !== 'S0' && symbol !== 'S1',
            });

            await runOverallWarmStep(input);

            expect(mockOverall).toHaveBeenCalledTimes(
                OVERALL_WARM_MAX_PER_TICK
            );
        });
    });

    describe('실패', () => {
        it('cached·done이 아니면 실패로 세고 태그를 털지 않는다', async () => {
            mockOverall.mockResolvedValue({ status: 'error', code: 'x' });
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const input = makeInput(newState());

            await runOverallWarmStep(input);
            const logged = messages(warn);
            warn.mockRestore();

            expect(input.counts.overallWarmFailed).toBe(1);
            expect(input.counts.overallWarmed).toBe(0);
            expect(mockRevalidateTag).not.toHaveBeenCalled();
            expect(logged).toContain(
                '[seo-prewarm] overall-warm skip HOT: status=error'
            );
        });

        it('null 결과도 실패다', async () => {
            mockOverall.mockResolvedValue(null);
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const input = makeInput(newState());

            await runOverallWarmStep(input);
            warn.mockRestore();

            expect(input.counts.overallWarmFailed).toBe(1);
        });

        it('던지면 삼키고 실패로 세며, 다음 심볼은 계속 처리한다', async () => {
            mockOverall.mockRejectedValueOnce(new Error('boom'));
            const error = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            const input = makeInput(newState(), { symbols: ['A', 'B'] });

            await runOverallWarmStep(input);
            const logged = messages(error);
            error.mockRestore();

            expect(input.counts.overallWarmFailed).toBe(1);
            expect(input.counts.overallWarmed).toBe(1);
            expect(logged).toContain('[seo-prewarm] overall-warm error A');
        });
    });

    describe('심볼 처리 대기열 우선', () => {
        it('대기열이 남았으면 claim 없이 단계를 건너뛰고 센다', async () => {
            const input = makeInput(newState(), { hasBacklog: true });

            await runOverallWarmStep(input);

            expect(input.counts.overallWarmSkippedByBacklog).toBe(1);
            expect(mockIsOverallWarmClaimed).not.toHaveBeenCalled();
            expect(mockClaimOverallWarm).not.toHaveBeenCalled();
            expect(mockOverall).not.toHaveBeenCalled();
        });

        it('대기열이 있어도 대기 목록 확인(싸고 LLM 없음)은 돈다', async () => {
            mockListOverallWarmPending.mockResolvedValue([
                pending('HOT', START_MS, 0),
            ]);
            const input = makeInput(
                newState(START_MS + OVERALL_WARM_TIMEOUT_MS),
                {
                    hasBacklog: true,
                }
            );

            await runOverallWarmStep(input);

            expect(mockRevalidateTag).toHaveBeenCalledWith(
                'overall-peek:HOT',
                'max'
            );
            expect(input.counts.overallWarmPendingRevalidated).toBe(1);
            expect(mockOverall).not.toHaveBeenCalled();
        });

        it('대상이 비면 대기열이 있어도 건너뜀으로 세지 않는다', async () => {
            const input = makeInput(newState(), {
                symbols: [],
                hasBacklog: true,
            });

            await runOverallWarmStep(input);

            expect(input.counts.overallWarmSkippedByBacklog).toBe(0);
        });
    });

    describe('UTC 일일 시작 상한', () => {
        it('상한 직전(23)이면 시작하고 시작 전에 카운터를 올린다', async () => {
            mockGetOverallWarmStartsToday.mockResolvedValue(
                OVERALL_WARM_MAX_STARTS_PER_UTC_DAY - 1
            );
            const input = makeInput(newState());

            await runOverallWarmStep(input);

            expect(mockGetOverallWarmStartsToday).toHaveBeenCalledWith(
                '2026-11-20'
            );
            expect(mockIncrementOverallWarmStartsToday).toHaveBeenCalledWith(
                '2026-11-20'
            );
            expect(input.counts.overallWarmed).toBe(1);
        });

        it('상한(24)에 닿으면 claim 없이 건너뛰고 센다', async () => {
            mockGetOverallWarmStartsToday.mockResolvedValue(
                OVERALL_WARM_MAX_STARTS_PER_UTC_DAY
            );
            const input = makeInput(newState());

            await runOverallWarmStep(input);

            expect(input.counts.overallWarmSkippedByDailyCap).toBe(1);
            expect(mockClaimOverallWarm).not.toHaveBeenCalled();
            expect(mockIncrementOverallWarmStartsToday).not.toHaveBeenCalled();
            expect(mockOverall).not.toHaveBeenCalled();
        });

        it('claim을 못 얻으면 카운터를 올리지 않는다(실제로 시작할 때만 센다)', async () => {
            mockClaimOverallWarm.mockResolvedValue(false);
            const input = makeInput(newState());

            await runOverallWarmStep(input);

            expect(mockIncrementOverallWarmStartsToday).not.toHaveBeenCalled();
        });

        it('이미 시도한 심볼은 상한으로도 세지 않는다', async () => {
            mockIsOverallWarmClaimed.mockResolvedValue(true);
            mockGetOverallWarmStartsToday.mockResolvedValue(
                OVERALL_WARM_MAX_STARTS_PER_UTC_DAY
            );
            const input = makeInput(newState());

            await runOverallWarmStep(input);

            expect(input.counts.overallWarmSkippedByDailyCap).toBe(0);
        });
    });

    describe('자산 정보 조회도 같은 상한 안이다', () => {
        it('조회가 끝나지 않아도 상한에서 포기하고 대기 목록에 올린다', async () => {
            mockGetAssetInfoResilient.mockReturnValue(new Promise(() => {}));
            const state = newState();
            state.expireSleep = true;
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const input = makeInput(state);

            await runOverallWarmStep(input);
            warn.mockRestore();

            expect(input.counts.overallWarmTimedOut).toBe(1);
            expect(mockAddOverallWarmPending).toHaveBeenCalledWith(
                'HOT',
                START_MS
            );
            expect(mockOverall).not.toHaveBeenCalled();
        });
    });

    describe('시간 초과와 대기 목록', () => {
        it('상한을 넘기면 포기하고 센 뒤 시작 시각으로 대기 목록에 올린다 — 태그는 털지 않는다', async () => {
            mockOverall.mockReturnValue(new Promise(() => {}));
            const state = newState();
            state.expireSleep = true;
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const input = makeInput(state);

            await runOverallWarmStep(input);
            const logged = messages(warn);
            warn.mockRestore();

            expect(input.counts.overallWarmTimedOut).toBe(1);
            expect(input.counts.overallWarmed).toBe(0);
            expect(mockAddOverallWarmPending).toHaveBeenCalledWith(
                'HOT',
                START_MS
            );
            expect(mockRevalidateTag).not.toHaveBeenCalled();
            expect(
                logged.some(m =>
                    m.startsWith('[seo-prewarm] overall-warm timed out HOT')
                )
            ).toBe(true);
            // 알람이 걸린 문구와 겹치지 않는다.
            expect(
                logged.some(m => m.includes('[seo-prewarm] unit-timeout'))
            ).toBe(false);
        });

        it('상위 목록에 없는 심볼의 대기 항목도 확인하고 턴다', async () => {
            mockListOverallWarmPending.mockResolvedValue([
                pending('GONE', START_MS, 0),
            ]);
            const input = makeInput(
                newState(START_MS + OVERALL_WARM_TIMEOUT_MS),
                { symbols: ['HOT'] }
            );

            await runOverallWarmStep(input);

            expect(mockHasPrewarmedOverall).toHaveBeenCalledWith(
                'GONE',
                START_MS
            );
            expect(mockRevalidateTag).toHaveBeenCalledWith(
                'overall-peek:GONE',
                'max'
            );
            expect(mockRemoveOverallWarmPending).toHaveBeenCalledWith(
                'GONE|' + START_MS + '|0'
            );
            expect(input.counts.overallWarmPendingRevalidated).toBe(1);
        });

        it('상한보다 덜 지났으면 캐시를 확인하지도 털지도 않는다', async () => {
            mockListOverallWarmPending.mockResolvedValue([
                pending('HOT', START_MS, 0),
            ]);
            const input = makeInput(
                newState(START_MS + OVERALL_WARM_TIMEOUT_MS - 1),
                { symbols: [] }
            );

            await runOverallWarmStep(input);

            expect(mockHasPrewarmedOverall).not.toHaveBeenCalled();
            expect(mockRevalidateTag).not.toHaveBeenCalled();
            expect(mockRemoveOverallWarmPending).not.toHaveBeenCalled();
        });

        it('캐시에 아직 없으면 털지 않고 확인 횟수만 올려 항목을 남긴다', async () => {
            mockHasPrewarmedOverall.mockResolvedValue(false);
            const entry = pending('HOT', START_MS, 3);
            mockListOverallWarmPending.mockResolvedValue([entry]);
            const input = makeInput(
                newState(START_MS + OVERALL_WARM_TIMEOUT_MS),
                { symbols: [] }
            );

            await runOverallWarmStep(input);

            expect(mockRevalidateTag).not.toHaveBeenCalled();
            expect(mockBumpOverallWarmPendingChecks).toHaveBeenCalledWith(
                entry
            );
            expect(mockRemoveOverallWarmPending).not.toHaveBeenCalled();
            expect(input.counts.overallWarmPendingRevalidated).toBe(0);
        });

        it('확인 횟수가 차면 항목을 버린다(영원히 남지 않는다)', async () => {
            const entry = pending(
                'HOT',
                START_MS,
                OVERALL_WARM_PENDING_MAX_CHECKS
            );
            mockListOverallWarmPending.mockResolvedValue([entry]);
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const input = makeInput(
                newState(START_MS + OVERALL_WARM_TIMEOUT_MS)
            );

            await runOverallWarmStep(input);
            const logged = messages(warn);
            warn.mockRestore();

            expect(mockRemoveOverallWarmPending).toHaveBeenCalledWith(
                entry.member
            );
            expect(mockHasPrewarmedOverall).not.toHaveBeenCalled();
            expect(
                logged.some(m =>
                    m.startsWith(
                        '[seo-prewarm] overall-warm pending dropped HOT'
                    )
                )
            ).toBe(true);
        });

        it('12시간이 지난 항목은 캐시를 보지 않고 버린다', async () => {
            const entry = pending('HOT', START_MS, 0);
            mockListOverallWarmPending.mockResolvedValue([entry]);
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const input = makeInput(
                newState(START_MS + OVERALL_WARM_PENDING_MAX_AGE_MS)
            );

            await runOverallWarmStep(input);
            warn.mockRestore();

            expect(mockRemoveOverallWarmPending).toHaveBeenCalledWith(
                entry.member
            );
            expect(mockHasPrewarmedOverall).not.toHaveBeenCalled();
            expect(mockRevalidateTag).not.toHaveBeenCalled();
        });

        it('항목 하나의 캐시 확인이 던져도 삼키고 항목은 남긴다', async () => {
            mockHasPrewarmedOverall.mockRejectedValue(new Error('redis'));
            mockListOverallWarmPending.mockResolvedValue([
                pending('HOT', START_MS, 0),
            ]);
            const error = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            const input = makeInput(
                newState(START_MS + OVERALL_WARM_TIMEOUT_MS),
                { symbols: [] }
            );

            await runOverallWarmStep(input);
            const logged = messages(error);
            error.mockRestore();

            expect(mockRemoveOverallWarmPending).not.toHaveBeenCalled();
            expect(input.counts.overallWarmed).toBe(0);
            expect(logged).toContain(
                '[seo-prewarm] overall-warm pending revalidate error HOT'
            );
        });

        it('대기 목록을 못 읽어도 삼키고 다음 단계로 간다', async () => {
            mockListOverallWarmPending.mockRejectedValue(new Error('redis'));
            const error = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            const input = makeInput(newState());

            await runOverallWarmStep(input);
            const logged = messages(error);
            error.mockRestore();

            expect(input.counts.overallWarmed).toBe(1);
            expect(logged).toContain(
                '[seo-prewarm] overall-warm pending list error'
            );
        });
    });
});
