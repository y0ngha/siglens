/**
 * 조회 기반 캐던스(`QUIET_CADENCE_TABS`)와 종합 사전 생성의 배치 배선 가드.
 *
 * 앵커 계산은 `freshness.test.ts`, 활성 집합 선별은 `viewDemand.test.ts`가 고정한다. 이 파일은 그
 * 결과가 stale 판정·처리 직전 검사·기아 감시·종합 사전 생성에 실제로 쓰이는가만 본다. 달력은
 * `vi.setSystemTime`, 경과 시간은 주입한 `PrewarmClock`으로 고정한다.
 */
const {
    mockGetInFlightMarker,
    mockIsSkipped,
    mockMarkSkipped,
    mockClearInFlight,
    mockMarkInFlight,
    mockAddFmpBudget,
    mockGetFmpBudgetUsed,
    mockAdvanceRotationCursor,
    mockUpsert,
    mockFindGeneratedAtMap,
    mockGetAssetInfoResilient,
    mockGetFmpErrorStatus,
    mockPrewarmTechnical,
    mockPrewarmFundamental,
    mockBuildPrewarmUniverse,
    mockLoadViewDemand,
    mockClaimOverallWarm,
    mockIsOverallWarmClaimed,
    mockListOverallWarmPending,
    mockIsTransientlySkipped,
    mockGetOverallWarmStartsToday,
    mockIncrementOverallWarmStartsToday,
    mockPrewarmNews,
    mockPrewarmOverall,
    mockRevalidateTag,
} = vi.hoisted(() => ({
    mockGetInFlightMarker: vi.fn(),
    mockIsSkipped: vi.fn(),
    mockMarkSkipped: vi.fn(),
    mockClearInFlight: vi.fn(),
    mockMarkInFlight: vi.fn(),
    mockAddFmpBudget: vi.fn(),
    mockGetFmpBudgetUsed: vi.fn(),
    mockAdvanceRotationCursor: vi.fn(),
    mockUpsert: vi.fn(),
    mockFindGeneratedAtMap: vi.fn(),
    mockGetAssetInfoResilient: vi.fn(),
    mockGetFmpErrorStatus: vi.fn(),
    mockPrewarmTechnical: vi.fn(),
    mockPrewarmFundamental: vi.fn(),
    mockBuildPrewarmUniverse: vi.fn(),
    mockLoadViewDemand: vi.fn(),
    mockClaimOverallWarm: vi.fn(),
    mockIsOverallWarmClaimed: vi.fn(),
    mockListOverallWarmPending: vi.fn(),
    mockIsTransientlySkipped: vi.fn(),
    mockGetOverallWarmStartsToday: vi.fn(),
    mockIncrementOverallWarmStartsToday: vi.fn(),
    mockPrewarmNews: vi.fn(),
    mockPrewarmOverall: vi.fn(),
    mockRevalidateTag: vi.fn(),
}));

vi.mock('../fundamentalStamps', () => ({
    // 실제 단계는 FMP·DB·Redis를 친다 — 이 스위트는 그 단계를 보지 않는다(TESTING.md#TE-2).
    refreshFundamentalStamps: vi.fn(async () => ({ checked: 0, recorded: 0 })),
}));
vi.mock('../viewDemand', () => ({
    // 집계 읽기는 DB를 친다 — 활성 집합은 테스트가 직접 주입한다(`selectViewDemand` 자체는 viewDemand.test.ts).
    loadViewDemand: mockLoadViewDemand,
}));
vi.mock('../hubs', () => ({
    // 이 함수는 LLM·Redis를 실제로 친다. 목하지 않으면 이 파일의 모든
    // `runPrewarmBatch()` 호출이 그 경로를 타고, 전역 fetch 스텁이 **우연히**
    // 막아 주는 상태에 의존하게 된다(TESTING.md#TE-2).
    runHubPrewarm: vi.fn().mockResolvedValue({
        attempted: 0,
        generated: 0,
        alreadyFresh: 0,
        noData: 0,
        keyMismatch: 0,
        failed: 0,
        skippedByDeadline: 0,
        skippedByCooldown: 0,
        generatedUrls: [],
    }),
}));

vi.mock('../lock', () => ({
    markInFlight: mockMarkInFlight,
    getInFlightMarker: mockGetInFlightMarker,
    isSkipped: mockIsSkipped,
    markSkipped: mockMarkSkipped,
    clearInFlight: mockClearInFlight,
    addFmpBudget: mockAddFmpBudget,
    getFmpBudgetUsed: mockGetFmpBudgetUsed,
    advanceRotationCursor: mockAdvanceRotationCursor,
    claimOverallWarm: mockClaimOverallWarm,
    isOverallWarmClaimed: mockIsOverallWarmClaimed,
    listOverallWarmPending: mockListOverallWarmPending,
    isTransientlySkipped: mockIsTransientlySkipped,
    getOverallWarmStartsToday: mockGetOverallWarmStartsToday,
    incrementOverallWarmStartsToday: mockIncrementOverallWarmStartsToday,
    prewarmUnitKey: (symbol: string, tab: string) =>
        `${symbol.toUpperCase()}:${tab}`,
    loadStructurallyUnavailable: vi.fn().mockResolvedValue(new Set<string>()),
    markStructurallyUnavailable: vi.fn(),
    clearStructurallyUnavailable: vi.fn(),
    TRANSIENT_SKIP_TTL_SECONDS: 1800,
    LOCK_TTL_SECONDS: 900,
}));

vi.mock('next/cache', () => ({ revalidateTag: mockRevalidateTag }));

vi.mock('@/entities/seo-snapshot/api', () => ({
    DrizzleSeoSnapshotRepository: vi.fn().mockImplementation(function () {
        return {
            upsert: mockUpsert,
            findGeneratedAtMap: mockFindGeneratedAtMap,
        };
    }),
}));

vi.mock('@/entities/seo-snapshot/lib/applicability', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@/entities/seo-snapshot/lib/applicability')
    >()),
    buildPrewarmUniverse: mockBuildPrewarmUniverse,
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: {}, sql: {} }),
}));

vi.mock('@/entities/ticker/server/getAssetInfoResilient', () => ({
    getAssetInfoResilient: mockGetAssetInfoResilient,
}));

vi.mock('@/shared/api/fmp/fmpUserMessage', () => ({
    getFmpErrorStatus: mockGetFmpErrorStatus,
    translateFmpError: vi.fn().mockReturnValue(null),
}));

vi.mock('@/entities/analysis/api', () => ({
    prewarmTechnical: mockPrewarmTechnical,
    prewarmOverall: mockPrewarmOverall,
    prewarmFundamental: mockPrewarmFundamental,
    prewarmFinancials: vi.fn(),
    prewarmCongress: vi.fn(),
    prewarmPollOverall: vi.fn(),
    prewarmPollFundamental: vi.fn(),
    prewarmPollFinancials: vi.fn(),
    prewarmPollCongress: vi.fn(),
}));

vi.mock('@/entities/news-article/api', () => ({
    DrizzleNewsRepository: class {},
}));
vi.mock('@/entities/news-article/server/prewarmNews', () => ({
    prewarmNews: mockPrewarmNews,
}));

vi.mock('@/entities/options-chain/api', () => ({
    prewarmOptions: vi.fn(),
    prewarmPollOptions: vi.fn(),
}));

import { runPrewarmBatch, type PrewarmClock } from '../runPrewarmBatch';

function key(symbol: string, tab: string): string {
    return `${symbol}:${tab}`;
}

// 2026-11-20(금) 22:00 UTC — EST 정규 마감(21:00 UTC)+정착 버퍼 30분이 지나 그 날 마감이 경계다.
// 주 2회 앵커는 11-18(수) 00:00 UTC다.
const NOW_FRI = new Date('2026-11-20T22:00:00.000Z');
// 2026-11-21(토) 00:30 UTC — 토요일 앵커(11-21 00:00 UTC)를 막 지난 시각. 시장은 닫혀 있다.
const NOW_SAT = new Date('2026-11-21T00:30:00.000Z');
// 수요일 앵커 직후에 만든 행. 금요일엔 앵커 기준으로 fresh, 일별 마감 기준으로는 stale이다.
const GEN_WED = new Date('2026-11-18T05:00:00.000Z');
// 금요일 마감 경계 이후에 만든 행 — 어느 주기로도 fresh.
const GEN_FRI_AFTER_CLOSE = new Date('2026-11-20T21:30:00.000Z');
const FRI_CLOSE_BOUNDARY_MS = Date.parse('2026-11-20T21:00:00.000Z');

const ANY_TAB_PROSE = {
    summary: '기술적 분석 요약 문단입니다.',
    currentDriverKo: '뉴스 동인 문단입니다.',
    headlineKo: '종합 분석 헤드라인입니다.',
} as const;

interface ClockState {
    nowMs: number;
    sleeps: number;
    /** 이 번째 `sleep` 호출부터 즉시 만료한다(유닛 타임아웃 재현). 0이면 만료하지 않는다. */
    timeoutFromSleep: number;
}

function makeClock(state: ClockState): PrewarmClock {
    return {
        now: () => state.nowMs,
        sleep: () => {
            state.sleeps += 1;
            const expired =
                state.timeoutFromSleep > 0 &&
                state.sleeps >= state.timeoutFromSleep;
            return expired ? Promise.resolve() : new Promise<void>(() => {});
        },
    };
}

function newClockState(): ClockState {
    return { nowMs: 1_000_000, sleeps: 0, timeoutFromSleep: 0 };
}

function setUniverse(symbols: readonly string[]): void {
    mockBuildPrewarmUniverse.mockReturnValue(
        symbols.map(symbol => ({ symbol, tabs: ['technical', 'news'] }))
    );
}

function setDemand(
    active: readonly string[] | null,
    overallWarm: readonly string[] = []
): void {
    mockLoadViewDemand.mockResolvedValue({
        active: active === null ? null : new Set(active),
        overallWarm,
    });
}

function setGenerated(symbols: readonly string[], generatedAt: Date): void {
    mockFindGeneratedAtMap.mockResolvedValue(
        new Map(
            symbols.flatMap(symbol => [
                [key(symbol, 'technical'), generatedAt] as const,
                [key(symbol, 'news'), generatedAt] as const,
            ])
        )
    );
}

function calledSymbols(mock: { mock: { calls: unknown[][] } }): unknown[] {
    return mock.mock.calls.map(([symbol]) => symbol);
}

function loggedMessages(spy: { mock: { calls: unknown[][] } }): string[] {
    return spy.mock.calls.map(([message]) => String(message));
}

describe('조회 기반 캐던스와 종합 사전 생성 배선', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(NOW_FRI);

        mockGetInFlightMarker.mockResolvedValue({
            present: false,
            jobId: null,
        });
        mockIsSkipped.mockResolvedValue(false);
        mockAddFmpBudget.mockResolvedValue(0);
        mockGetFmpBudgetUsed.mockResolvedValue(0);
        mockAdvanceRotationCursor.mockResolvedValue(0);
        mockGetFmpErrorStatus.mockReturnValue(null);
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
        mockPrewarmTechnical.mockResolvedValue({
            status: 'cached',
            result: ANY_TAB_PROSE,
        });
        mockPrewarmNews.mockResolvedValue({
            status: 'cached',
            result: ANY_TAB_PROSE,
        });
        mockPrewarmOverall.mockResolvedValue({
            status: 'done',
            result: ANY_TAB_PROSE,
        });
        mockClaimOverallWarm.mockResolvedValue(true);
        mockIsOverallWarmClaimed.mockResolvedValue(false);
        mockListOverallWarmPending.mockResolvedValue([]);
        mockIsTransientlySkipped.mockResolvedValue(false);
        mockGetOverallWarmStartsToday.mockResolvedValue(0);
        setUniverse(['QUIET', 'ACTIVE']);
        setDemand(['ACTIVE']);
        setGenerated(['QUIET', 'ACTIVE'], GEN_WED);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    describe('주기', () => {
        it('조용한 심볼은 앵커 사이에 pending이 아니고, 활성 심볼은 마감 뒤 pending이다', async () => {
            await runPrewarmBatch(makeClock(newClockState()));

            expect(calledSymbols(mockPrewarmTechnical)).toEqual(['ACTIVE']);
            expect(calledSymbols(mockPrewarmNews)).toEqual(['ACTIVE']);
        });

        it('조용한 심볼도 앵커를 지나면 pending이 된다', async () => {
            vi.setSystemTime(NOW_SAT);

            await runPrewarmBatch(makeClock(newClockState()));

            expect(calledSymbols(mockPrewarmTechnical)).toContain('QUIET');
            expect(calledSymbols(mockPrewarmNews)).toContain('QUIET');
        });

        it('다른 탭 때문에 선택된 조용한 심볼도 처리 직전 검사에서 같은 경계를 쓴다 — fresh한 technical은 건드리지 않는다', async () => {
            mockBuildPrewarmUniverse.mockReturnValue([
                { symbol: 'QUIET', tabs: ['technical', 'fundamental'] },
            ]);
            mockFindGeneratedAtMap.mockResolvedValue(
                new Map([
                    [key('QUIET', 'technical'), GEN_WED],
                    [
                        key('QUIET', 'fundamental'),
                        new Date('2026-11-01T00:00:00.000Z'),
                    ],
                ])
            );
            mockPrewarmFundamental.mockResolvedValue({
                status: 'cached',
                result: ANY_TAB_PROSE,
            });

            await runPrewarmBatch(makeClock(newClockState()));

            expect(mockPrewarmFundamental).toHaveBeenCalledTimes(1);
            expect(mockPrewarmTechnical).not.toHaveBeenCalled();
        });

        it('집계를 못 읽으면(active=null) 조용한 심볼도 매 세션 돈다', async () => {
            setDemand(null);

            await runPrewarmBatch(makeClock(newClockState()));

            expect(calledSymbols(mockPrewarmTechnical)).toEqual(
                expect.arrayContaining(['QUIET', 'ACTIVE'])
            );
            expect(calledSymbols(mockPrewarmNews)).toEqual(
                expect.arrayContaining(['QUIET', 'ACTIVE'])
            );
        });

        it('집계를 못 읽으면 종합 사전 생성도 하지 않는다', async () => {
            setDemand(null, []);

            const counts = await runPrewarmBatch(makeClock(newClockState()));

            expect(mockPrewarmOverall).not.toHaveBeenCalled();
            expect(mockClaimOverallWarm).not.toHaveBeenCalled();
            expect(counts.overallWarmed).toBe(0);
        });

        it('마감 뒤에 이미 만든 행은 활성이어도 fresh다 — 조용해졌다 활성이 돼도 뒤집히지 않는다', async () => {
            setGenerated(['QUIET', 'ACTIVE'], GEN_FRI_AFTER_CLOSE);

            await runPrewarmBatch(makeClock(newClockState()));

            expect(mockPrewarmTechnical).not.toHaveBeenCalled();
            expect(mockPrewarmNews).not.toHaveBeenCalled();
        });
    });

    describe('카운트', () => {
        it('활성·조용한 심볼 수를 싣는다', async () => {
            setUniverse(['A1', 'Q1', 'Q2']);
            setDemand(['A1']);
            setGenerated(['A1', 'Q1', 'Q2'], GEN_WED);

            const counts = await runPrewarmBatch(makeClock(newClockState()));

            expect(counts.activeSymbols).toBe(1);
            expect(counts.quietSymbols).toBe(2);
            expect(counts.overallWarmed).toBe(0);
        });

        it('집계를 모르면 activeSymbols는 null이고 quietSymbols는 0이다', async () => {
            setDemand(null);

            const counts = await runPrewarmBatch(makeClock(newClockState()));

            expect(counts.activeSymbols).toBeNull();
            expect(counts.quietSymbols).toBe(0);
        });
    });

    describe('기아 감시', () => {
        // 앵커(토 00:00) 직후 조용한 심볼의 행은 수요일 것이라 3일 19시간 묵었다 — 정상이다.
        beforeEach(() => {
            vi.setSystemTime(NOW_SAT);
            setUniverse(['QUIET']);
            setGenerated(['QUIET'], GEN_WED);
        });

        it('3일 묵은 조용한 심볼은 기아로 찍지 않는다', async () => {
            setDemand(['SOMEONE_ELSE']);
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

            await runPrewarmBatch(makeClock(newClockState()));

            expect(
                loggedMessages(warn).filter(m => m.includes('starvation watch'))
            ).toEqual([]);
        });

        it('같은 나이의 활성(또는 집계 불명) 심볼은 종전대로 기아로 찍는다', async () => {
            setDemand(null);
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

            await runPrewarmBatch(makeClock(newClockState()));

            expect(
                loggedMessages(warn).some(m => m.includes('starvation watch'))
            ).toBe(true);
        });

        // 조용한 심볼은 행 나이가 아니라 "앵커 이후 얼마나 지났는가"로 잰다. 토 00:05에 만든 행은 수요일 앵커
        // (11-18 00:00 UTC)에 due가 되고, 24시간이 지난 목 00:05에 처음 찍힌다 — 예전 6일 문턱이면 금 00:05다.
        const GEN_SAT_0005 = new Date('2026-11-14T00:05:00.000Z');

        it('앵커 뒤 24시간이 지나기 전에는 찍지 않는다(수 23:55)', async () => {
            vi.setSystemTime(new Date('2026-11-18T23:55:00.000Z'));
            setGenerated(['QUIET'], GEN_SAT_0005);
            setDemand(['SOMEONE_ELSE']);
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

            await runPrewarmBatch(makeClock(newClockState()));

            expect(
                loggedMessages(warn).filter(m => m.includes('starvation watch'))
            ).toEqual([]);
        });

        it('앵커 뒤 24시간이 지났는데 행이 앵커보다 옛것이면 첫 보고가 나간다(목 00:05)', async () => {
            vi.setSystemTime(new Date('2026-11-19T00:05:00.000Z'));
            setGenerated(['QUIET'], GEN_SAT_0005);
            setDemand(['SOMEONE_ELSE']);
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

            await runPrewarmBatch(makeClock(newClockState()));

            expect(
                loggedMessages(warn).some(m => m.includes('starvation watch'))
            ).toBe(true);
        });

        it('주말에 막 조용해진 심볼은 앵커가 24시간 넘게 지났어도 마지막 마감 뒤의 행이면 찍지 않는다', async () => {
            // 월 03:00 UTC: 앵커(토 00:00)는 51시간 전이고 행(금 22:00)은 앵커보다 옛것이지만, 마지막 마감(금 21:00)
            // 뒤에 만든 행이라 정규 갱신을 놓친 게 아니다 — 오늘 밤 차례를 기다릴 뿐이다.
            vi.setSystemTime(new Date('2026-11-23T03:00:00.000Z'));
            setGenerated(['QUIET'], new Date('2026-11-20T22:00:00.000Z'));
            setDemand(['SOMEONE_ELSE']);
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

            await runPrewarmBatch(makeClock(newClockState()));

            expect(
                loggedMessages(warn).filter(m => m.includes('starvation watch'))
            ).toEqual([]);
        });

        it('앵커 뒤에 갱신된 조용한 심볼은 24시간이 지나도 찍지 않는다', async () => {
            vi.setSystemTime(new Date('2026-11-19T00:05:00.000Z'));
            setGenerated(['QUIET'], GEN_WED);
            setDemand(['SOMEONE_ELSE']);
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

            await runPrewarmBatch(makeClock(newClockState()));

            expect(
                loggedMessages(warn).filter(m => m.includes('starvation watch'))
            ).toEqual([]);
        });
    });

    describe('종합 사전 생성 배선', () => {
        beforeEach(() => {
            setUniverse(['HOT']);
            setDemand(['HOT'], ['HOT']);
        });

        it('이번 tick에 처리되지 않은(이미 fresh인) 심볼도 상위 목록이면 만든다', async () => {
            setGenerated(['HOT'], GEN_FRI_AFTER_CLOSE);

            const counts = await runPrewarmBatch(makeClock(newClockState()));

            expect(mockPrewarmTechnical).not.toHaveBeenCalled();
            expect(mockPrewarmNews).not.toHaveBeenCalled();
            expect(mockClaimOverallWarm).toHaveBeenCalledWith(
                'HOT',
                FRI_CLOSE_BOUNDARY_MS,
                expect.any(Number)
            );
            expect(mockPrewarmOverall).toHaveBeenCalledWith(
                'HOT',
                'HOT Inc.',
                false
            );
            expect(mockRevalidateTag).toHaveBeenCalledWith(
                'overall-peek:HOT',
                'max'
            );
            expect(counts.overallWarmed).toBe(1);
        });

        it('이번 실행에서 technical을 막 만든 심볼도 만든다', async () => {
            setGenerated(['HOT'], GEN_WED);

            const counts = await runPrewarmBatch(makeClock(newClockState()));

            expect(mockPrewarmTechnical).toHaveBeenCalledTimes(1);
            expect(counts.overallWarmed).toBe(1);
        });

        it('technical이 실패해 아직 stale이면 만들지 않는다', async () => {
            setGenerated(['HOT'], GEN_WED);
            mockPrewarmTechnical.mockResolvedValue({ status: 'error' });

            await runPrewarmBatch(makeClock(newClockState()));

            expect(mockClaimOverallWarm).not.toHaveBeenCalled();
            expect(mockPrewarmOverall).not.toHaveBeenCalled();
        });

        it('조회 상위 목록에 없는 심볼은 만들지 않는다', async () => {
            setGenerated(['HOT'], GEN_FRI_AFTER_CLOSE);
            setDemand(['HOT'], []);

            await runPrewarmBatch(makeClock(newClockState()));

            expect(mockPrewarmOverall).not.toHaveBeenCalled();
        });

        it('집계를 못 읽으면 만들지 않는다', async () => {
            setGenerated(['HOT'], GEN_FRI_AFTER_CLOSE);
            setDemand(null, []);

            const counts = await runPrewarmBatch(makeClock(newClockState()));

            expect(mockPrewarmOverall).not.toHaveBeenCalled();
            expect(mockIsOverallWarmClaimed).not.toHaveBeenCalled();
            expect(counts.overallWarmed).toBe(0);
        });

        it('시간 예산이 모자라면 claim 없이 건너뛰고 센다 — 마감이 지나도 소리 없이 사라지지 않는다', async () => {
            setGenerated(['HOT'], GEN_WED);
            const state = newClockState();
            // 심볼 처리 중 8분이 흘렀다: 시작 한도(락 획득 후 470초)를 넘긴다.
            mockPrewarmTechnical.mockImplementation(async () => {
                state.nowMs += 480_000;
                return { status: 'cached', result: ANY_TAB_PROSE };
            });

            const counts = await runPrewarmBatch(makeClock(state));

            expect(counts.overallWarmSkippedByBudget).toBe(1);
            expect(mockClaimOverallWarm).not.toHaveBeenCalled();
            expect(mockPrewarmOverall).not.toHaveBeenCalled();
        });

        it('claim이 이미 있으면 같은 경계에서 두 번째로 만들지 않는다', async () => {
            setGenerated(['HOT'], GEN_FRI_AFTER_CLOSE);
            mockIsOverallWarmClaimed.mockResolvedValue(true);

            const counts = await runPrewarmBatch(makeClock(newClockState()));

            expect(mockClaimOverallWarm).not.toHaveBeenCalled();
            expect(mockPrewarmOverall).not.toHaveBeenCalled();
            expect(counts.overallWarmed).toBe(0);
        });

        it('이번 tick에 심볼 처리 배치가 가득 찼으면 종합은 건너뛰고 센다', async () => {
            const symbols = Array.from({ length: 12 }, (_, i) => `S${i}`);
            setUniverse(['HOT', ...symbols]);
            setDemand(['HOT', ...symbols], ['HOT']);
            setGenerated(['HOT', ...symbols], GEN_WED);
            // HOT이 12개 배치 안에 들어가도록 회전 커서를 0으로 두고, stale이 13개라 배치는 가득 찬다.

            const counts = await runPrewarmBatch(makeClock(newClockState()));

            expect(counts.overallWarmSkippedByBacklog).toBe(1);
            expect(mockClaimOverallWarm).not.toHaveBeenCalled();
            expect(mockPrewarmOverall).not.toHaveBeenCalled();
        });

        it('stale이어도 backoff라 배치가 차지 않는 심볼이 있으면 대기열로 보지 않는다', async () => {
            setUniverse(['HOT', 'BACKOFF']);
            setDemand(['HOT', 'BACKOFF'], ['HOT']);
            setGenerated(['HOT'], GEN_FRI_AFTER_CLOSE);
            mockIsSkipped.mockImplementation(
                async (symbol: string) => symbol === 'BACKOFF'
            );

            const counts = await runPrewarmBatch(makeClock(newClockState()));

            expect(counts.remaining).toBeGreaterThanOrEqual(0);
            expect(counts.overallWarmSkippedByBacklog).toBe(0);
            expect(counts.overallWarmed).toBe(1);
        });

        it('후보 창에 일시적 backoff로 막힌 심볼이 있으면 배치가 짧아도 대기열로 본다(장애 중)', async () => {
            setUniverse(['HOT', 'BLOCKED']);
            setDemand(['HOT', 'BLOCKED'], ['HOT']);
            setGenerated(['HOT'], GEN_FRI_AFTER_CLOSE);
            mockIsSkipped.mockImplementation(
                async (symbol: string) => symbol === 'BLOCKED'
            );
            mockIsTransientlySkipped.mockResolvedValue(true);

            const counts = await runPrewarmBatch(makeClock(newClockState()));

            expect(counts.overallWarmSkippedByBacklog).toBe(1);
            expect(mockClaimOverallWarm).not.toHaveBeenCalled();
            expect(mockPrewarmOverall).not.toHaveBeenCalled();
        });

        it('살아 있는 in-flight 마커로 막힌 후보도 일시적이라 대기열로 본다', async () => {
            setUniverse(['HOT', 'BUSY']);
            setDemand(['HOT', 'BUSY'], ['HOT']);
            setGenerated(['HOT'], GEN_FRI_AFTER_CLOSE);
            mockGetInFlightMarker.mockImplementation(
                async (symbol: string) => ({
                    present: symbol === 'BUSY',
                    jobId: null,
                })
            );

            const counts = await runPrewarmBatch(makeClock(newClockState()));

            expect(counts.overallWarmSkippedByBacklog).toBe(1);
            expect(mockPrewarmOverall).not.toHaveBeenCalled();
        });

        it('시작 한도는 락 획득 시각 기준이다 — 배치 시작 기준이었다면 시작했을 시각이라도 건너뛴다', async () => {
            setGenerated(['HOT'], GEN_FRI_AFTER_CLOSE);
            const state = newClockState();
            // 락 획득이 배치 시작보다 500초 앞섰다: 락 기준 시작 한도(락 획득 후 470초)가 이미 지났다.
            const counts = await runPrewarmBatch(
                makeClock(state),
                state.nowMs - 500_000
            );

            expect(counts.overallWarmSkippedByBudget).toBe(1);
            expect(mockPrewarmOverall).not.toHaveBeenCalled();
        });

        it('락 획득 시각을 생략하면 배치 시작 기준이라 시작한다', async () => {
            setGenerated(['HOT'], GEN_FRI_AFTER_CLOSE);

            const counts = await runPrewarmBatch(makeClock(newClockState()));

            expect(counts.overallWarmSkippedByBudget).toBe(0);
            expect(counts.overallWarmed).toBe(1);
        });

        it('batch done에 싣는 카운트가 모두 있다', async () => {
            setGenerated(['HOT'], GEN_FRI_AFTER_CLOSE);

            const counts = await runPrewarmBatch(makeClock(newClockState()));

            expect(counts).toMatchObject({
                overallWarmed: 1,
                overallWarmSkippedByBudget: 0,
                overallWarmSkippedByBacklog: 0,
                overallWarmSkippedByDailyCap: 0,
                overallWarmTimedOut: 0,
                overallWarmFailed: 0,
                overallWarmPendingRevalidated: 0,
            });
        });
    });

    describe('장중 미룸', () => {
        // 수 00:00 UTC 앵커 직후. KRX(09:00~15:30 KST = 00:00~06:30 UTC)가 열려 있는 동안 국내 종목은 미룬다.
        const KR = '005930.KS';

        beforeEach(() => {
            setUniverse([KR]);
            setDemand(['SOMEONE_ELSE']);
            mockFindGeneratedAtMap.mockResolvedValue(
                new Map([
                    [
                        key(KR, 'technical'),
                        new Date('2026-11-14T08:00:00.000Z'),
                    ],
                    [key(KR, 'news'), new Date('2026-11-14T08:00:00.000Z')],
                ])
            );
        });

        it('조용한 국내 종목은 KRX 장중에는 미루고, 장이 닫힌 뒤 창에서 집는다', async () => {
            vi.setSystemTime(new Date('2026-11-18T03:00:00.000Z'));
            await runPrewarmBatch(makeClock(newClockState()));
            expect(mockPrewarmTechnical).not.toHaveBeenCalled();

            vi.setSystemTime(new Date('2026-11-18T10:30:00.000Z'));
            await runPrewarmBatch(makeClock(newClockState()));

            expect(mockPrewarmTechnical).toHaveBeenCalledWith(
                KR,
                expect.any(String),
                undefined,
                false
            );
        });
    });
});
