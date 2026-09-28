/**
 * 주 2회 캐던스(fundamental/financials/congress) 배선 가드.
 *
 * `snapshotBoundaryFor` 자체의 앵커 계산은
 * `entities/seo-snapshot/__tests__/freshness.test.ts`가 고정한다. 이 파일은
 * "그 앵커가 실제로 pre-warm 배치의 stale 판정에 쓰이는가"만 본다 — 배선이
 * 빠지면(예: 모든 탭이 여전히 일별 마감 경계를 쓰면) 하룻밤 새 118탭 전량이
 * 재생성되는 회귀가 조용히 재발한다.
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
}));

vi.mock('../hubs', () => ({
    // 이 함수는 LLM·Redis를 실제로 친다. 목하지 않으면 이 파일의 모든
    // `runPrewarmBatch()` 호출이 그 경로를 타고, 전역 fetch 스텁이 **우연히**
    // 막아 주는 상태에 의존하게 된다(MISTAKES.md §8.6).
    runHubPrewarm: vi.fn().mockResolvedValue({
        attempted: 0,
        generated: 0,
        alreadyFresh: 0,
        noData: 0,
        keyMismatch: 0,
        failed: 0,
        skippedByDeadline: 0,
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
    prewarmUnitKey: (symbol: string, tab: string) =>
        `${symbol.toUpperCase()}:${tab}`,
    loadStructurallyUnavailable: vi.fn().mockResolvedValue(new Set<string>()),
    markStructurallyUnavailable: vi.fn(),
    clearStructurallyUnavailable: vi.fn(),
    TRANSIENT_SKIP_TTL_SECONDS: 1800,
    LOCK_TTL_SECONDS: 900,
}));

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));

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

vi.mock('@/entities/ticker/lib/getAssetInfoResilient', () => ({
    getAssetInfoResilient: mockGetAssetInfoResilient,
}));

vi.mock('@/shared/api/fmp/fmpUserMessage', () => ({
    getFmpErrorStatus: mockGetFmpErrorStatus,
    translateFmpError: vi.fn().mockReturnValue(null),
}));

vi.mock('@/entities/analysis/api', () => ({
    prewarmTechnical: mockPrewarmTechnical,
    prewarmOverall: vi.fn(),
    prewarmFundamental: mockPrewarmFundamental,
    prewarmFinancials: vi.fn(),
    prewarmCongress: vi.fn(),
    prewarmPollOverall: vi.fn(),
    prewarmPollFundamental: vi.fn(),
    prewarmPollFinancials: vi.fn(),
    prewarmPollCongress: vi.fn(),
}));

vi.mock('@/entities/news-article/api', () => ({
    prewarmNews: vi.fn(),
    prewarmPollNews: vi.fn(),
}));

vi.mock('@/entities/options-chain/api', () => ({
    prewarmOptions: vi.fn(),
    prewarmPollOptions: vi.fn(),
}));

import { runPrewarmBatch } from '../runPrewarmBatch';

function key(symbol: string, tab: string): string {
    return `${symbol}:${tab}`;
}

// 2026-09-17(목) 20:35 UTC — EDT 정규 마감(20:00 UTC) 이후 35분 경과(정착 버퍼
// 30분을 이미 지난 시점)라 그 날 마감을 완료로 본다. 같은 요일의 주 2회 앵커(수/토)는 09-16(수) 00:00 UTC다.
const GENERATED_THU = new Date('2026-09-17T20:35:00.000Z');
// 2026-09-18(금) 20:35 UTC — 금요일 마감(20:00 UTC)+35분 경과 시점에서 조회.
// 일별 마감 경계는 그 날 20:00 UTC로 롤하지만, 주 2회 앵커는 여전히 09-16(수)다.
const CHECK_FRI = new Date('2026-09-18T20:35:00.000Z');

describe('slow-refresh 캐던스(fundamental/financials/congress) 배선', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();

        mockGetInFlightMarker.mockResolvedValue({
            present: false,
            jobId: null,
        });
        mockIsSkipped.mockResolvedValue(false);
        mockAddFmpBudget.mockResolvedValue(0);
        mockGetFmpBudgetUsed.mockResolvedValue(0);
        mockAdvanceRotationCursor.mockResolvedValue(0);
        mockGetFmpErrorStatus.mockReturnValue(null);
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: {
                symbol: 'CADENCE',
                name: 'Cadence Inc.',
                fmpSymbol: undefined,
            },
            degraded: false,
        });
        mockBuildPrewarmUniverse.mockReturnValue([
            { symbol: 'CADENCE', tabs: ['technical', 'fundamental'] },
        ]);
        mockFindGeneratedAtMap.mockResolvedValue(
            new Map([
                [key('CADENCE', 'technical'), GENERATED_THU],
                [key('CADENCE', 'fundamental'), GENERATED_THU],
            ])
        );
        mockPrewarmTechnical.mockResolvedValue({
            status: 'cached',
            result: {},
        });
        mockPrewarmFundamental.mockResolvedValue({
            status: 'cached',
            result: {},
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('목요일에 생성된 fundamental은 금요일에도 fresh — seam이 안 불린다', async () => {
        vi.setSystemTime(CHECK_FRI);

        const counts = await runPrewarmBatch();

        expect(mockPrewarmFundamental).not.toHaveBeenCalled();
        // technical은 일별 마감 경계라 금요일 마감이 롤해 stale — 이 대조가 없으면
        // "아무 탭도 안 불렸다"는 무관한 이유(예: 배치 자체가 안 돎)로도 통과한다.
        expect(mockPrewarmTechnical).toHaveBeenCalled();
        expect(counts.harvested).toBe(1);
    });
});
