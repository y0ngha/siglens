const {
    mockMarkInFlight,
    mockGetInFlightMarker,
    mockIsSkipped,
    mockMarkSkipped,
    mockClearInFlight,
    mockAddFmpBudget,
    mockGetFmpBudgetUsed,
    mockRevalidateTag,
    mockUpsert,
    mockFindGeneratedAtMap,
    mockGetAssetInfoResilient,
    mockGetFmpErrorStatus,
    mockPrewarmTechnical,
    mockPrewarmOverall,
    mockPrewarmFundamental,
    mockPrewarmFinancials,
    mockPrewarmCongress,
    mockPrewarmNews,
    mockPrewarmOptions,
    mockPrewarmPollTechnical,
    mockPrewarmPollOverall,
    mockPrewarmPollFundamental,
    mockPrewarmPollFinancials,
    mockPrewarmPollCongress,
    mockPrewarmPollNews,
    mockPrewarmPollOptions,
    mockBuildPrewarmUniverse,
} = vi.hoisted(() => ({
    mockMarkInFlight: vi.fn(),
    mockGetInFlightMarker: vi.fn(),
    mockIsSkipped: vi.fn(),
    mockMarkSkipped: vi.fn(),
    mockClearInFlight: vi.fn(),
    mockAddFmpBudget: vi.fn(),
    mockGetFmpBudgetUsed: vi.fn(),
    mockRevalidateTag: vi.fn(),
    mockUpsert: vi.fn(),
    mockFindGeneratedAtMap: vi.fn(),
    mockGetAssetInfoResilient: vi.fn(),
    mockGetFmpErrorStatus: vi.fn(),
    mockPrewarmTechnical: vi.fn(),
    mockPrewarmOverall: vi.fn(),
    mockPrewarmFundamental: vi.fn(),
    mockPrewarmFinancials: vi.fn(),
    mockPrewarmCongress: vi.fn(),
    mockPrewarmNews: vi.fn(),
    mockPrewarmOptions: vi.fn(),
    mockPrewarmPollTechnical: vi.fn(),
    mockPrewarmPollOverall: vi.fn(),
    mockPrewarmPollFundamental: vi.fn(),
    mockPrewarmPollFinancials: vi.fn(),
    mockPrewarmPollCongress: vi.fn(),
    mockPrewarmPollNews: vi.fn(),
    mockPrewarmPollOptions: vi.fn(),
    mockBuildPrewarmUniverse: vi.fn(),
}));

vi.mock('../lock', () => ({
    markInFlight: mockMarkInFlight,
    getInFlightMarker: mockGetInFlightMarker,
    isSkipped: mockIsSkipped,
    markSkipped: mockMarkSkipped,
    clearInFlight: mockClearInFlight,
    addFmpBudget: mockAddFmpBudget,
    getFmpBudgetUsed: mockGetFmpBudgetUsed,
}));

vi.mock('next/cache', () => ({
    revalidateTag: mockRevalidateTag,
}));

vi.mock('@/entities/seo-snapshot/api', () => ({
    DrizzleSeoSnapshotRepository: vi.fn().mockImplementation(function () {
        return {
            upsert: mockUpsert,
            findGeneratedAtMap: mockFindGeneratedAtMap,
        };
    }),
}));

vi.mock('@/entities/seo-snapshot/lib/applicability', () => ({
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
}));

vi.mock('@/entities/analysis/api', () => ({
    prewarmTechnical: mockPrewarmTechnical,
    prewarmOverall: mockPrewarmOverall,
    prewarmFundamental: mockPrewarmFundamental,
    prewarmFinancials: mockPrewarmFinancials,
    prewarmCongress: mockPrewarmCongress,
    prewarmPollTechnical: mockPrewarmPollTechnical,
    prewarmPollOverall: mockPrewarmPollOverall,
    prewarmPollFundamental: mockPrewarmPollFundamental,
    prewarmPollFinancials: mockPrewarmPollFinancials,
    prewarmPollCongress: mockPrewarmPollCongress,
}));

vi.mock('@/entities/news-article/api', () => ({
    prewarmNews: mockPrewarmNews,
    prewarmPollNews: mockPrewarmPollNews,
}));

vi.mock('@/entities/options-chain/api', () => ({
    prewarmOptions: mockPrewarmOptions,
    prewarmPollOptions: mockPrewarmPollOptions,
}));

import type { SeoSnapshotTab } from '@/entities/seo-snapshot';
import type { PrewarmSymbol } from '@/entities/seo-snapshot/lib/applicability';
import { lastCompletedEtCloseWithBuffer } from '@/entities/seo-snapshot/lib/freshness';
import { runPrewarmBatch, type PrewarmClock } from '../runPrewarmBatch';

const FIXED_NOW = new Date('2026-07-25T13:00:00.000Z');
const BOUNDARY = lastCompletedEtCloseWithBuffer(FIXED_NOW);
const STALE_DATE = new Date(BOUNDARY.getTime() - 24 * 60 * 60 * 1000);
const BATCH_DEADLINE_MS = 600_000;

function universe(...symbols: PrewarmSymbol[]): void {
    mockBuildPrewarmUniverse.mockReturnValue(symbols);
}

function key(symbol: string, tab: SeoSnapshotTab): string {
    return `${symbol}:${tab}`;
}

/**
 * FIX G/Z 테스트 전용 시뮬레이션 clock — `now()`는 누적 경과 시간을, `sleep(ms)`는
 * 그 경과 시간을 실제로 진행시킨다(실제 wall-clock 대기 없음). 동시성(Promise.all)
 * 하에서도 "총 sleep 호출 시간의 합"이라는 불변식은 유지되므로 call-count 기반
 * mock보다 견고하다.
 */
function makeSimClock(startMs: number): PrewarmClock {
    let t = startMs;
    return {
        now: () => t,
        sleep: async (ms: number) => {
            t += ms;
        },
    };
}

describe('runPrewarmBatch', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(FIXED_NOW);

        mockFindGeneratedAtMap.mockResolvedValue(new Map());
        mockGetInFlightMarker.mockResolvedValue({
            present: false,
            jobId: null,
        });
        mockIsSkipped.mockResolvedValue(false);
        mockAddFmpBudget.mockResolvedValue(0);
        mockGetFmpBudgetUsed.mockResolvedValue(0);
        mockGetFmpErrorStatus.mockReturnValue(null);
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: { symbol: 'X', name: 'X Inc.', fmpSymbol: undefined },
            degraded: false,
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('모든 탭이 fresh인 심볼은 배치에서 제외된다', async () => {
        universe({ symbol: 'AAPL', tabs: ['technical'] });
        mockFindGeneratedAtMap.mockResolvedValue(
            new Map([[key('AAPL', 'technical'), BOUNDARY]])
        );

        const counts = await runPrewarmBatch();

        expect(counts.submitted).toBe(0);
        expect(counts.harvested).toBe(0);
        expect(counts.remaining).toBe(0);
        expect(mockPrewarmTechnical).not.toHaveBeenCalled();
    });

    it('저장된 generatedAt이 boundary보다 오래되면 stale로 간주해 재처리한다', async () => {
        universe({ symbol: 'OLD', tabs: ['technical'] });
        mockFindGeneratedAtMap.mockResolvedValue(
            new Map([[key('OLD', 'technical'), STALE_DATE]])
        );
        mockPrewarmTechnical.mockResolvedValue({
            status: 'cached',
            result: {},
        });

        const counts = await runPrewarmBatch();

        expect(mockPrewarmTechnical).toHaveBeenCalled();
        expect(counts.harvested).toBe(1);
    });

    it('심볼이 소문자/혼합 대소문자여도 UPPERCASE generatedAtMap 키와 매칭해 fresh로 판정한다', async () => {
        // findGeneratedAtMap(api.ts)은 항상 UPPERCASE 키로 저장한다. universe에
        // 소문자 심볼이 섞여 들어와도 freshness lookup이 miss하지 않아야 한다.
        universe({ symbol: 'aapl', tabs: ['technical'] });
        mockFindGeneratedAtMap.mockResolvedValue(
            new Map([[key('AAPL', 'technical'), BOUNDARY]])
        );

        const counts = await runPrewarmBatch();

        expect(counts.submitted).toBe(0);
        expect(counts.harvested).toBe(0);
        expect(mockPrewarmTechnical).not.toHaveBeenCalled();
    });

    it('cached 결과는 upsert하고, 전 탭이 fresh해지면 revalidate한다', async () => {
        universe({ symbol: 'MSFT', tabs: ['technical', 'overall'] });
        mockFindGeneratedAtMap.mockResolvedValue(new Map());
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: {
                symbol: 'MSFT',
                name: 'Microsoft Corp.',
                fmpSymbol: undefined,
            },
            degraded: false,
        });
        const technicalResult = { status: 'cached', result: { a: 1 } };
        const overallResult = { status: 'cached', result: { b: 2 } };
        mockPrewarmTechnical.mockResolvedValue(technicalResult);
        mockPrewarmOverall.mockResolvedValue(overallResult);

        const counts = await runPrewarmBatch();

        expect(mockPrewarmTechnical).toHaveBeenCalledWith(
            'MSFT',
            'Microsoft Corp.',
            undefined,
            false
        );
        expect(mockPrewarmOverall).toHaveBeenCalledWith(
            'MSFT',
            'Microsoft Corp.',
            false
        );
        expect(mockUpsert).toHaveBeenCalledWith(
            expect.objectContaining({
                symbol: 'MSFT',
                tab: 'technical',
                content: { a: 1 },
                generatedAt: FIXED_NOW,
            })
        );
        expect(mockUpsert).toHaveBeenCalledWith(
            expect.objectContaining({
                symbol: 'MSFT',
                tab: 'overall',
                content: { b: 2 },
                generatedAt: FIXED_NOW,
            })
        );
        expect(counts.harvested).toBe(2);
        expect(mockRevalidateTag).toHaveBeenCalledWith(
            'seo-snapshot:MSFT',
            'max'
        );
        expect(counts.revalidated).toBe(1);
        // 2탭 모두 seam이 실제로 실행됨 → equity per-tab(3) × 2 = 6.
        expect(mockAddFmpBudget).toHaveBeenCalledWith(6);
    });

    it('FMP 402 에러는 해당 유닛만 격리하고 배치는 계속 진행한다', async () => {
        universe(
            { symbol: 'A', tabs: ['technical', 'overall'] },
            { symbol: 'B', tabs: ['technical'] }
        );
        const error402 = new Error('FMP /profile 402');
        mockPrewarmTechnical.mockImplementation((symbol: string) => {
            if (symbol === 'A') return Promise.reject(error402);
            return Promise.resolve({ status: 'cached', result: {} });
        });
        mockPrewarmOverall.mockResolvedValue({ status: 'cached', result: {} });
        mockGetFmpErrorStatus.mockImplementation(err =>
            err === error402 ? 402 : null
        );
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const counts = await runPrewarmBatch();

        expect(errSpy).toHaveBeenCalledWith(
            '[seo-prewarm] fmp-402 A:technical'
        );
        // A의 overall과 B의 technical은 정상 처리되어야 한다 (배치 중단 없음).
        expect(counts.harvested).toBe(2);
        errSpy.mockRestore();
    });

    it('일반 에러(500 등)도 해당 유닛만 격리하고 배치는 계속 진행한다', async () => {
        universe({ symbol: 'C', tabs: ['technical', 'overall'] });
        const genericError = new Error('boom');
        mockPrewarmTechnical.mockRejectedValue(genericError);
        mockPrewarmOverall.mockResolvedValue({ status: 'cached', result: {} });
        mockGetFmpErrorStatus.mockReturnValue(null);
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const counts = await runPrewarmBatch();

        expect(errSpy).toHaveBeenCalledWith(
            '[seo-prewarm] unit-error C:technical',
            genericError
        );
        expect(counts.harvested).toBe(1);
        errSpy.mockRestore();
    });

    it('SYMBOLS_PER_TICK(6, FIX Z 재조정)을 초과하면 나머지는 remaining으로 잡힌다', async () => {
        const symbols: PrewarmSymbol[] = Array.from({ length: 15 }, (_, i) => ({
            symbol: `SYM${i}`,
            tabs: ['technical'] as SeoSnapshotTab[],
        }));
        universe(...symbols);
        mockPrewarmTechnical.mockResolvedValue({
            status: 'submitted',
            jobId: 'job',
        });
        mockPrewarmPollTechnical.mockResolvedValue({ status: 'processing' });

        const clock = makeSimClock(FIXED_NOW.getTime());
        const counts = await runPrewarmBatch(clock);

        expect(mockPrewarmTechnical).toHaveBeenCalledTimes(6);
        expect(counts.remaining).toBe(9);
    });

    it('options seam이 null을 반환하면 스킵하고 upsert하지 않으며 backoff(FIX C) 마커를 남긴다', async () => {
        universe({ symbol: 'D', tabs: ['options'] });
        mockPrewarmOptions.mockResolvedValue(null);
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const counts = await runPrewarmBatch();

        expect(mockUpsert).not.toHaveBeenCalled();
        expect(mockMarkInFlight).not.toHaveBeenCalled();
        expect(mockMarkSkipped).toHaveBeenCalledWith('D', 'options');
        expect(counts.submitted).toBe(0);
        expect(counts.harvested).toBe(0);
        expect(counts.revalidated).toBe(0);

        warnSpy.mockRestore();
    });

    it('크립토 심볼은 실행된 seam 1개당 FMP 예산을 1로 계상한다', async () => {
        universe({ symbol: 'BTCUSD', tabs: ['technical'] });
        mockPrewarmTechnical.mockResolvedValue({
            status: 'cached',
            result: {},
        });

        await runPrewarmBatch();

        expect(mockAddFmpBudget).toHaveBeenCalledWith(1);
    });

    it('assetInfo.name이 falsy(빈 문자열/undefined)면 companyName은 symbol로 폴백한다', async () => {
        universe({ symbol: 'NONAME', tabs: ['technical'] });
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: {
                symbol: 'NONAME',
                name: undefined,
                fmpSymbol: undefined,
            },
            degraded: false,
        });
        mockPrewarmTechnical.mockResolvedValue({
            status: 'cached',
            result: {},
        });

        await runPrewarmBatch();

        expect(mockPrewarmTechnical).toHaveBeenCalledWith(
            'NONAME',
            'NONAME',
            undefined,
            false
        );
    });

    it('getAssetInfoResilient가 degrade되면 companyName=symbol, fmpSymbol=undefined로 폴백한다', async () => {
        universe({ symbol: 'E', tabs: ['technical'] });
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: { symbol: 'E', name: 'E' },
            degraded: true,
        });
        mockPrewarmTechnical.mockResolvedValue({
            status: 'cached',
            result: {},
        });

        await runPrewarmBatch();

        expect(mockPrewarmTechnical).toHaveBeenCalledWith(
            'E',
            'E',
            undefined,
            false
        );
    });

    it('배치 종료 후 fmpBudgetUsed를 getFmpBudgetUsed 반환값으로 채운다', async () => {
        universe({ symbol: 'F', tabs: ['technical'] });
        mockPrewarmTechnical.mockResolvedValue({
            status: 'cached',
            result: {},
        });
        mockGetFmpBudgetUsed.mockResolvedValue(123);

        const counts = await runPrewarmBatch();

        expect(counts.fmpBudgetUsed).toBe(123);
    });

    it('청크 내 한 심볼이 예외를 던져도(getAssetInfoResilient throw) 형제 심볼들은 정상 처리된다', async () => {
        // SYMBOL_CONCURRENCY=3 — 동일 청크에 3개를 넣어 BAD가 outer catch로
        // 격리되고 GOOD1/GOOD2는 영향받지 않음을 검증한다.
        universe(
            { symbol: 'GOOD1', tabs: ['technical'] },
            { symbol: 'BAD', tabs: ['technical'] },
            { symbol: 'GOOD2', tabs: ['technical'] }
        );
        mockGetAssetInfoResilient.mockImplementation((symbol: string) => {
            if (symbol === 'BAD')
                return Promise.reject(new Error('asset info boom'));
            return Promise.resolve({
                assetInfo: { symbol, name: symbol, fmpSymbol: undefined },
                degraded: false,
            });
        });
        mockPrewarmTechnical.mockResolvedValue({
            status: 'cached',
            result: {},
        });
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const counts = await runPrewarmBatch();

        expect(errSpy).toHaveBeenCalledWith(
            '[seo-prewarm] BAD failed:',
            expect.any(Error)
        );
        // GOOD1/GOOD2 둘 다 harvest되어야 한다 — BAD의 실패가 형제를 막지 않는다.
        expect(counts.harvested).toBe(2);
        expect(mockPrewarmTechnical).toHaveBeenCalledWith(
            'GOOD1',
            'GOOD1',
            undefined,
            false
        );
        expect(mockPrewarmTechnical).toHaveBeenCalledWith(
            'GOOD2',
            'GOOD2',
            undefined,
            false
        );
        errSpy.mockRestore();
    });

    it('일부 탭이 이미 fresh인 심볼은 그 탭의 seam을 호출하지 않고도 freshTabCount에 반영하며, 나머지 탭이 harvest되면 revalidate한다', async () => {
        universe({ symbol: 'H', tabs: ['technical', 'overall'] });
        mockFindGeneratedAtMap.mockResolvedValue(
            new Map([[key('H', 'technical'), BOUNDARY]])
        );
        mockPrewarmOverall.mockResolvedValue({
            status: 'cached',
            result: { c: 3 },
        });

        const counts = await runPrewarmBatch();

        expect(mockPrewarmTechnical).not.toHaveBeenCalled();
        expect(mockPrewarmOverall).toHaveBeenCalled();
        expect(counts.harvested).toBe(1);
        expect(mockRevalidateTag).toHaveBeenCalledWith('seo-snapshot:H', 'max');
        expect(counts.revalidated).toBe(1);
        // technical은 이미 fresh라 seam이 안 불렸으니 예산엔 overall 1탭분만.
        expect(mockAddFmpBudget).toHaveBeenCalledWith(3);
    });

    it('한 심볼의 일부 탭이 stale로 남으면 revalidate하지 않는다(FIX Z — submitted+jobId는 즉시 poll된다)', async () => {
        universe({ symbol: 'G', tabs: ['technical', 'overall'] });
        mockPrewarmTechnical.mockResolvedValue({
            status: 'cached',
            result: {},
        });
        mockPrewarmOverall.mockResolvedValue({
            status: 'submitted',
            jobId: 'job',
        });
        mockPrewarmPollOverall.mockResolvedValue({ status: 'processing' });

        const clock = makeSimClock(FIXED_NOW.getTime());
        const counts = await runPrewarmBatch(clock);

        expect(counts.harvested).toBe(1);
        expect(counts.submitted).toBe(1);
        expect(mockPrewarmPollOverall).toHaveBeenCalledWith('job');
        expect(mockRevalidateTag).not.toHaveBeenCalled();
        expect(counts.revalidated).toBe(0);
    });

    // ── FIX A(감사) — 공정 선별: 회전 오프셋 + resumable 우선 + backoff 배제 ──

    it('회전 오프셋 — freshCount만큼 배치 후보 시작점이 회전한다(Math.random 없이 결정적)', async () => {
        // 3개는 이미 전 탭 fresh(freshCount=3에 기여), 10개는 stale(S0..S9).
        const freshOnes: PrewarmSymbol[] = Array.from(
            { length: 3 },
            (_, i) => ({
                symbol: `FRESH${i}`,
                tabs: ['technical'] as SeoSnapshotTab[],
            })
        );
        const staleOnes: PrewarmSymbol[] = Array.from(
            { length: 10 },
            (_, i) => ({
                symbol: `S${i}`,
                tabs: ['technical'] as SeoSnapshotTab[],
            })
        );
        universe(...freshOnes, ...staleOnes);
        mockFindGeneratedAtMap.mockResolvedValue(
            new Map(freshOnes.map(f => [key(f.symbol, 'technical'), BOUNDARY]))
        );
        mockPrewarmTechnical.mockResolvedValue({
            status: 'cached',
            result: {},
        });

        await runPrewarmBatch();

        // freshCount=3 → offset=3%10=3 → 회전된 순서 S3..S8(6개, SYMBOLS_PER_TICK=6)가
        // 선택되고 S0,S1,S2,S9는 이번 tick엔 선택되지 않는다(멤버십만 검증 — 동시
        // Promise.all 처리라 호출 "순서"는 검증하지 않는다).
        const calledSymbols = mockPrewarmTechnical.mock.calls.map(c => c[0]);
        expect(calledSymbols).toHaveLength(6);
        for (const s of ['S3', 'S4', 'S5', 'S6', 'S7', 'S8']) {
            expect(calledSymbols).toContain(s);
        }
        for (const s of ['S0', 'S1', 'S2', 'S9']) {
            expect(calledSymbols).not.toContain(s);
        }
    });

    it('resumable(in-flight jobId 보유) 심볼을 신규 stale 심볼보다 먼저 채운다(FIX A/Z)', async () => {
        const freshOnes: PrewarmSymbol[] = Array.from(
            { length: 6 },
            (_, i) => ({
                symbol: `F${i}`,
                tabs: ['technical'] as SeoSnapshotTab[],
            })
        );
        universe({ symbol: 'RESUME', tabs: ['technical'] }, ...freshOnes);
        mockGetInFlightMarker.mockImplementation(async (symbol: string) =>
            symbol === 'RESUME'
                ? { present: true, jobId: 'job-x' }
                : { present: false, jobId: null }
        );
        mockPrewarmPollTechnical.mockResolvedValue({ status: 'processing' });
        mockPrewarmTechnical.mockResolvedValue({
            status: 'cached',
            result: {},
        });

        const clock = makeSimClock(FIXED_NOW.getTime());
        const counts = await runPrewarmBatch(clock);

        expect(mockPrewarmTechnical).not.toHaveBeenCalledWith(
            'RESUME',
            expect.anything(),
            expect.anything(),
            expect.anything()
        );
        expect(mockPrewarmPollTechnical).toHaveBeenCalledWith('job-x');
        // 7개 stale(RESUME + F0..F5) 중 배치 6자리 = RESUME(resumable, 항상 포함) +
        // fresh 5개(6개 중 1개는 이번 tick에서 밀려난다).
        expect(mockPrewarmTechnical).toHaveBeenCalledTimes(5);
        expect(counts.remaining).toBe(1);
    });

    it('기존 in-flight jobId가 있으면 재제출 대신 poll-resume한다(FIX Z) — submit(seam)은 호출되지 않고 예산도 계상되지 않는다', async () => {
        universe({ symbol: 'GOOGL', tabs: ['technical'] });
        mockGetInFlightMarker.mockResolvedValue({
            present: true,
            jobId: 'existing-job',
        });
        mockPrewarmPollTechnical.mockResolvedValue({
            status: 'done',
            result: { a: 1 },
        });

        const counts = await runPrewarmBatch();

        expect(mockPrewarmTechnical).not.toHaveBeenCalled();
        expect(mockPrewarmPollTechnical).toHaveBeenCalledWith('existing-job');
        expect(mockUpsert).toHaveBeenCalled();
        expect(counts.harvested).toBe(1);
        // resume-poll은 새 FMP 호출이 아니다 — 예산에 계상되지 않는다.
        expect(mockAddFmpBudget).not.toHaveBeenCalled();
    });

    // ── FIX 1(감사, PR #698 리뷰) — legacy in-flight 마커(present, jobId 없음) ──

    it('legacy 마커(present, jobId 없음)가 있는 유닛은 재제출되지 않는다(seam 미호출) — 회귀 가드', async () => {
        // 픽스 전에는 getInFlightJobId만 확인해 legacy 마커를 "in-flight 아님"으로
        // 오판하고 매 tick 재제출했다(overall의 pending_dependencies가 실제 사례).
        universe(
            { symbol: 'LEGACY', tabs: ['technical'] },
            { symbol: 'NEXT', tabs: ['technical'] }
        );
        mockGetInFlightMarker.mockImplementation(async (symbol: string) =>
            symbol === 'LEGACY'
                ? { present: true, jobId: null }
                : { present: false, jobId: null }
        );
        mockPrewarmTechnical.mockResolvedValue({
            status: 'cached',
            result: {},
        });

        const counts = await runPrewarmBatch();

        // LEGACY의 seam(submit)은 호출되지 않는다 — 재제출 금지(호출된 심볼
        // 중 'LEGACY'가 없는지 직접 검사한다 — expect.anything()은 실제
        // fmpSymbol=undefined 인자와 결코 매칭되지 않아 .not.toHaveBeenCalledWith가
        // 그런 매처들과 섞이면 무조건 통과하는 약한 단언이 되므로 피한다).
        const calledSymbols = mockPrewarmTechnical.mock.calls.map(c => c[0]);
        expect(calledSymbols).not.toContain('LEGACY');
        // poll도 호출되지 않는다 — legacy 마커는 resume-poll 대상이 아니다.
        expect(mockPrewarmPollTechnical).not.toHaveBeenCalled();
        // NEXT는 정상 처리된다.
        expect(mockPrewarmTechnical).toHaveBeenCalledWith(
            'NEXT',
            'X Inc.',
            undefined,
            false
        );
        // LEGACY는 selectFairBatch 단계에서 'blocked'로 배제되어 배치 슬롯을
        // 소비하지 않는다 — staleSymbols 2개 중 배치엔 NEXT 1개만 들어가고
        // LEGACY는 remaining으로 남는다(재시도 대기, 재제출 아님).
        expect(counts.remaining).toBe(1);
        expect(counts.harvested).toBe(1); // NEXT만 harvest.
        expect(mockMarkInFlight).not.toHaveBeenCalledWith(
            'LEGACY',
            'technical',
            expect.anything()
        );
    });

    it('jobId 있는 마커는 여전히 poll-resume된다(legacy 마커와의 회귀 구분 가드)', async () => {
        universe({ symbol: 'RESUMABLE', tabs: ['technical'] });
        mockGetInFlightMarker.mockResolvedValue({
            present: true,
            jobId: 'job-resume',
        });
        mockPrewarmPollTechnical.mockResolvedValue({
            status: 'done',
            result: { warmed: true },
        });

        const counts = await runPrewarmBatch();

        expect(mockPrewarmTechnical).not.toHaveBeenCalled();
        expect(mockPrewarmPollTechnical).toHaveBeenCalledWith('job-resume');
        expect(counts.harvested).toBe(1);
    });

    it('마커가 아예 없는 유닛은 오늘도 정상 submit된다(회귀 없음 가드)', async () => {
        universe({ symbol: 'NOMARKER', tabs: ['technical'] });
        mockGetInFlightMarker.mockResolvedValue({
            present: false,
            jobId: null,
        });
        mockPrewarmTechnical.mockResolvedValue({
            status: 'cached',
            result: {},
        });

        const counts = await runPrewarmBatch();

        expect(mockPrewarmTechnical).toHaveBeenCalledWith(
            'NOMARKER',
            'X Inc.',
            undefined,
            false
        );
        expect(counts.harvested).toBe(1);
    });

    // ── FIX C(감사) — terminal skip(backoff) ──

    it('모든 stale 탭이 backoff(skip) 중인 심볼은 배제되고 슬롯이 다음 심볼로 간다', async () => {
        universe(
            { symbol: 'SKIPPED', tabs: ['technical'] },
            { symbol: 'NEXT', tabs: ['technical'] }
        );
        mockIsSkipped.mockImplementation(
            async (symbol: string) => symbol === 'SKIPPED'
        );
        mockPrewarmTechnical.mockResolvedValue({
            status: 'cached',
            result: {},
        });

        const counts = await runPrewarmBatch();

        expect(mockPrewarmTechnical).toHaveBeenCalledTimes(1);
        expect(mockPrewarmTechnical).toHaveBeenCalledWith(
            'NEXT',
            'X Inc.', // beforeEach의 mockGetAssetInfoResilient 기본값
            undefined,
            false
        );
        expect(counts.harvested).toBe(1);
    });

    it('terminal skip 후 다음 tick에서 같은 유닛이 재선별되지 않는다(FIX C 회귀 가드) — 선별 단계가 backoff 마커를 존중한다', async () => {
        universe({ symbol: 'ERRSYM', tabs: ['technical'] });
        mockPrewarmTechnical.mockResolvedValue({ status: 'error' });
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        // tick 1 — terminal skip → markSkipped가 실제로 호출된다.
        await runPrewarmBatch();
        expect(mockPrewarmTechnical).toHaveBeenCalledTimes(1);
        expect(mockMarkSkipped).toHaveBeenCalledWith('ERRSYM', 'technical');

        // tick 2 — 방금 세팅된 backoff 마커가 있다고 가정(isSkipped=true)하면
        // 선별 단계에서 배제되어 seam이 다시 호출되지 않아야 한다.
        mockIsSkipped.mockResolvedValue(true);
        mockPrewarmTechnical.mockClear();

        await runPrewarmBatch();
        expect(mockPrewarmTechnical).not.toHaveBeenCalled();

        warnSpy.mockRestore();
    });

    // ── FIX G(감사) — 배치 wall-clock 데드라인 ──

    it('배치 데드라인 초과 시 남은 청크를 건너뛰고 부분 counts를 반환하며 로그를 남긴다', async () => {
        // 6개 stale 심볼(SYMBOL_CONCURRENCY=3 → 2청크), 전부 즉시 cached로 끝나
        // 폴링 없음 → clock.now() 호출은 [배치데드라인 계산, 청크0 사전체크,
        // 청크1 사전체크] 정확히 3회뿐이라 call-count 기반 목이 안전하다.
        const symbols: PrewarmSymbol[] = Array.from({ length: 6 }, (_, i) => ({
            symbol: `SYM${i}`,
            tabs: ['technical'] as SeoSnapshotTab[],
        }));
        universe(...symbols);
        mockPrewarmTechnical.mockResolvedValue({
            status: 'cached',
            result: {},
        });
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const base = FIXED_NOW.getTime();
        let calls = 0;
        const now = () => {
            calls++;
            return calls <= 2 ? base : base + BATCH_DEADLINE_MS + 1;
        };
        const sleep = vi.fn().mockResolvedValue(undefined);

        const counts = await runPrewarmBatch({ now, sleep });

        expect(mockPrewarmTechnical).toHaveBeenCalledTimes(3); // 청크0(3개)만 처리됨
        expect(counts.remaining).toBe(3); // 청크1의 3개가 remaining으로
        expect(warnSpy).toHaveBeenCalledWith(
            '[seo-prewarm] batch deadline reached — 3 symbols processed, 3 remaining'
        );

        warnSpy.mockRestore();
    });

    it('정상 배치는 데드라인에 영향받지 않는다 — 데드라인 로그가 없다', async () => {
        universe({ symbol: 'NORMAL', tabs: ['technical'] });
        mockPrewarmTechnical.mockResolvedValue({
            status: 'cached',
            result: {},
        });
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await runPrewarmBatch();

        expect(warnSpy).not.toHaveBeenCalledWith(
            expect.stringContaining('batch deadline reached')
        );

        warnSpy.mockRestore();
    });

    // ── FIX Z(감사) — submit 후 즉시 poll(콜드 캐시를 실제로 데운다) ──

    it('submitted+jobId → poll이 done을 반환하면 upsert가 일어나고 counts.harvested가 증가한다(콜드 캐시 워밍의 핵심 회귀 가드)', async () => {
        universe({ symbol: 'COLD', tabs: ['technical'] });
        mockPrewarmTechnical.mockResolvedValue({
            status: 'submitted',
            jobId: 'job-cold',
        });
        mockPrewarmPollTechnical.mockResolvedValue({
            status: 'done',
            result: { warmed: true },
        });

        const counts = await runPrewarmBatch();

        expect(mockMarkInFlight).toHaveBeenCalledWith(
            'COLD',
            'technical',
            'job-cold'
        );
        expect(mockPrewarmPollTechnical).toHaveBeenCalledWith('job-cold');
        expect(mockUpsert).toHaveBeenCalledWith(
            expect.objectContaining({
                symbol: 'COLD',
                tab: 'technical',
                content: { warmed: true },
            })
        );
        expect(counts.harvested).toBe(1);
        expect(counts.submitted).toBe(1);
    });

    it('poll이 cap(60s)까지 processing이면 harvest 없이 counts.submitted만 늘어나고 in-flight 마커는 유지된다', async () => {
        universe({ symbol: 'SLOW', tabs: ['technical'] });
        mockPrewarmTechnical.mockResolvedValue({
            status: 'submitted',
            jobId: 'job-slow',
        });
        mockPrewarmPollTechnical.mockResolvedValue({ status: 'processing' });

        const clock = makeSimClock(FIXED_NOW.getTime());
        const counts = await runPrewarmBatch(clock);

        expect(mockMarkInFlight).toHaveBeenCalledWith(
            'SLOW',
            'technical',
            'job-slow'
        );
        // 최초 1회 + elapsedMs가 0,5000,...,55000일 때마다 재시도(12회) = 13회에서
        // elapsedMs가 60000에 도달해 캡에 걸려 멈춘다.
        expect(mockPrewarmPollTechnical).toHaveBeenCalledTimes(13);
        expect(mockUpsert).not.toHaveBeenCalled();
        expect(counts.submitted).toBe(1);
        expect(counts.harvested).toBe(0);
        // "여전히 processing"은 markSkipped/clearInFlight 어느 쪽도 건드리지 않는다
        // (다음 tick이 이어서 poll할 수 있게 in-flight 마커를 그대로 둔다).
        expect(mockMarkSkipped).not.toHaveBeenCalled();
        expect(mockClearInFlight).not.toHaveBeenCalled();
    });

    it('poll이 throw하면 해당 유닛만 격리되고 배치는 계속 진행한다(fail-open)', async () => {
        universe({ symbol: 'POLLTHROW', tabs: ['technical'] });
        mockPrewarmTechnical.mockResolvedValue({
            status: 'submitted',
            jobId: 'job-e',
        });
        mockPrewarmPollTechnical.mockRejectedValue(new Error('poll boom'));
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const counts = await runPrewarmBatch();

        expect(errSpy).toHaveBeenCalledWith(
            '[seo-prewarm] unit-error POLLTHROW:technical',
            expect.any(Error)
        );
        expect(counts.harvested).toBe(0);
        errSpy.mockRestore();
    });

    it('poll이 status=error를 반환하면(throw 아님) terminal skip 처리되고 배치는 계속 진행한다', async () => {
        universe({ symbol: 'POLLBAD', tabs: ['technical'] });
        mockPrewarmTechnical.mockResolvedValue({
            status: 'submitted',
            jobId: 'job-b',
        });
        mockPrewarmPollTechnical.mockResolvedValue({
            status: 'error',
            error: 'worker failed',
        });
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const counts = await runPrewarmBatch();

        expect(mockMarkSkipped).toHaveBeenCalledWith('POLLBAD', 'technical');
        expect(counts.harvested).toBe(0);

        warnSpy.mockRestore();
    });

    it('poll 루프 중 배치 데드라인에 걸리면 processing 상태 그대로 정리하고 남긴다(FIX G × Z)', async () => {
        universe({ symbol: 'DEADPOLL', tabs: ['technical'] });
        mockPrewarmTechnical.mockResolvedValue({
            status: 'submitted',
            jobId: 'job-d',
        });
        mockPrewarmPollTechnical.mockResolvedValue({ status: 'processing' });

        const base = FIXED_NOW.getTime();
        let t = base;
        // 첫 sleep에서 배치 데드라인(10min)을 훌쩍 넘겨버린다 — poll 루프가
        // 유닛 캡(60s)까지 다 못 가고 배치 데드라인에 먼저 걸려야 한다.
        const now = () => t;
        const sleep = vi.fn().mockImplementation(async () => {
            t += BATCH_DEADLINE_MS;
        });

        const counts = await runPrewarmBatch({ now, sleep });

        // 최초 1회(즉시) + sleep 후 재확인 1회 = 2회에서 멈춘다(12회까지 안 감).
        expect(mockPrewarmPollTechnical).toHaveBeenCalledTimes(2);
        expect(counts.submitted).toBe(1);
        expect(counts.harvested).toBe(0);
    });
});
