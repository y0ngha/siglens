/**
 * 실제 `loadViewDemand`와 합친 배치 배선 가드(폴백 경로).
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
    mockTopViewed,
    mockClaimOverallWarm,
    mockIsOverallWarmClaimed,
    mockMarkOverallWarmPending,
    mockGetOverallWarmPendingSince,
    mockClearOverallWarmPending,
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
    mockTopViewed: vi.fn(),
    mockClaimOverallWarm: vi.fn(),
    mockIsOverallWarmClaimed: vi.fn(),
    mockMarkOverallWarmPending: vi.fn(),
    mockGetOverallWarmPendingSince: vi.fn(),
    mockClearOverallWarmPending: vi.fn(),
    mockPrewarmNews: vi.fn(),
    mockPrewarmOverall: vi.fn(),
    mockRevalidateTag: vi.fn(),
}));

vi.mock('../fundamentalStamps', () => ({
    // 실제 단계는 FMP·DB·Redis를 친다 — 이 스위트는 그 단계를 보지 않는다(TESTING.md#TE-2).
    refreshFundamentalStamps: vi.fn(async () => ({ checked: 0, recorded: 0 })),
}));
vi.mock('@/entities/symbol-view/api', () => ({
    DrizzleSymbolViewRepository: vi.fn().mockImplementation(function () {
        return { topViewed: mockTopViewed };
    }),
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
    // 종합 사전 생성 대기 목록 — 이 스위트는 그 단계를 보지 않는다.
    listOverallWarmPending: async () => [],
    isTransientlySkipped: async () => false,
    claimOverallWarm: mockClaimOverallWarm,
    isOverallWarmClaimed: mockIsOverallWarmClaimed,
    markOverallWarmPending: mockMarkOverallWarmPending,
    getOverallWarmPendingSince: mockGetOverallWarmPendingSince,
    clearOverallWarmPending: mockClearOverallWarmPending,
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

// 2026-11-21(토) 03:00 UTC = KST 11-21 12:00. 조회 창은 오늘(KST)과 앞 6개 날짜라 시작은 11-15다.
const NOW = new Date('2026-11-21T03:00:00.000Z');
const GEN_OLD = new Date('2026-11-14T05:00:00.000Z');

const ANY_TAB_PROSE = {
    summary: '기술적 분석 요약 문단입니다.',
    currentDriverKo: '뉴스 동인 문단입니다.',
    headlineKo: '종합 분석 헤드라인입니다.',
} as const;

const CLOCK: PrewarmClock = {
    now: () => 1_000_000,
    sleep: () => new Promise<void>(() => {}),
};

/**
 * `loadViewDemand`를 목하지 않고 실제 함수로 `runPrewarmBatch`를 돈다 — 폴백의 배선(저장소에 넘기는 인자와
 * `now`, 실패·빈 집계가 "전부 활성"으로 이어지는지)을 고정한다. 활성 집합 선별 자체는 viewDemand.test.ts가 본다.
 */
describe('runPrewarmBatch + 실제 loadViewDemand', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
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
        mockBuildPrewarmUniverse.mockReturnValue([
            { symbol: 'QUIET', tabs: ['technical', 'news'] },
        ]);
        mockFindGeneratedAtMap.mockResolvedValue(
            new Map([
                ['QUIET:technical', GEN_OLD],
                ['QUIET:news', GEN_OLD],
            ])
        );
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('저장소 읽기가 던지면 전부 활성으로 돌고, 조회 창 인자와 now를 그대로 넘긴다', async () => {
        mockTopViewed.mockRejectedValue(new Error('db down'));
        vi.spyOn(console, 'warn').mockImplementation(() => {});

        const counts = await runPrewarmBatch(CLOCK);

        expect(mockTopViewed).toHaveBeenCalledTimes(1);
        expect(mockTopViewed).toHaveBeenCalledWith('2026-11-15', 2);
        expect(counts.activeSymbols).toBeNull();
        expect(counts.quietSymbols).toBe(0);
        expect(counts.overallWarmed).toBe(0);
        expect(mockPrewarmTechnical).toHaveBeenCalledTimes(1);
        expect(mockClaimOverallWarm).not.toHaveBeenCalled();
    });

    it('집계가 비어도 전부 활성이다(비콘이 죽은 것으로 본다)', async () => {
        mockTopViewed.mockResolvedValue([]);
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const counts = await runPrewarmBatch(CLOCK);
        const logged = warn.mock.calls.map(([message]) => String(message));

        expect(counts.activeSymbols).toBeNull();
        expect(mockPrewarmTechnical).toHaveBeenCalledTimes(1);
        expect(logged).toContain(
            '[seo-prewarm] view tally empty, treating all symbols as active'
        );
    });

    it('집계가 있고 그 심볼이 활성이 아니면 조용한 심볼로 돈다(경계 대조)', async () => {
        mockTopViewed.mockResolvedValue([{ symbol: 'OTHER', views: 9 }]);
        mockBuildPrewarmUniverse.mockReturnValue([
            { symbol: 'QUIET', tabs: ['technical', 'news'] },
            { symbol: 'OTHER', tabs: ['technical', 'news'] },
        ]);
        // 토 03:00 UTC 앵커(토 00:00)보다 앞선 행이라 두 심볼 모두 pending이지만 집계는 OTHER만 활성이다.
        mockFindGeneratedAtMap.mockResolvedValue(
            new Map([
                ['QUIET:technical', new Date('2026-11-21T01:00:00.000Z')],
                ['QUIET:news', new Date('2026-11-21T01:00:00.000Z')],
                ['OTHER:technical', GEN_OLD],
                ['OTHER:news', GEN_OLD],
            ])
        );

        const counts = await runPrewarmBatch(CLOCK);

        expect(counts.activeSymbols).toBe(1);
        expect(counts.quietSymbols).toBe(1);
        expect(mockPrewarmTechnical).toHaveBeenCalledTimes(1);
        expect(mockPrewarmTechnical).toHaveBeenCalledWith(
            'OTHER',
            expect.any(String),
            undefined,
            false
        );
    });
});
