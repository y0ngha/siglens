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

    it('SYMBOLS_PER_TICK(6)을 초과하면 나머지는 remaining으로 잡힌다', async () => {
        const symbols: PrewarmSymbol[] = Array.from({ length: 15 }, (_, i) => ({
            symbol: `SYM${i}`,
            tabs: ['technical'] as SeoSnapshotTab[],
        }));
        universe(...symbols);
        mockPrewarmTechnical.mockResolvedValue({
            status: 'done',
            result: {},
        });

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
        // markInFlight is called before the seam, clearInFlight in finally.
        expect(mockMarkInFlight).toHaveBeenCalledWith('D', 'options');
        expect(mockClearInFlight).toHaveBeenCalledWith('D', 'options');
        expect(mockMarkSkipped).toHaveBeenCalledWith('D', 'options');
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
        // 동일 청크에 3개를 넣어 BAD가 outer catch로
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

    it('한 심볼의 일부 탭이 miss_no_trigger로 남으면 revalidate하지 않는다', async () => {
        universe({ symbol: 'G', tabs: ['technical', 'overall'] });
        mockPrewarmTechnical.mockResolvedValue({
            status: 'cached',
            result: {},
        });
        mockPrewarmOverall.mockResolvedValue({
            status: 'miss_no_trigger',
        });

        const clock = makeSimClock(FIXED_NOW.getTime());
        const counts = await runPrewarmBatch(clock);

        expect(counts.harvested).toBe(1);
        expect(mockRevalidateTag).not.toHaveBeenCalled();
        expect(counts.revalidated).toBe(0);
    });

    // ── FIX A(감사) — 공정 선별: 회전 오프셋 + resumable 우선 + backoff 배제 ──

    it('회전 오프셋 — tick 시각에서 결정적으로 파생된다(Math.random·Redis 커서 없이)', async () => {
        const staleOnes: PrewarmSymbol[] = Array.from(
            { length: 10 },
            (_, i) => ({
                symbol: `S${i}`,
                tabs: ['technical'] as SeoSnapshotTab[],
            })
        );
        universe(...staleOnes);
        mockFindGeneratedAtMap.mockResolvedValue(new Map());
        mockPrewarmTechnical.mockResolvedValue({
            status: 'cached',
            result: {},
        });

        // tick = floor(now / 5분) → offset = (tick × SYMBOLS_PER_TICK) % 10.
        // tick을 3으로 잡으면 offset = 18 % 10 = 8 → S8,S9,S0..S3이 선택된다.
        const TICK_MS = 5 * 60 * 1000;
        await runPrewarmBatch(makeSimClock(3 * TICK_MS));

        const calledSymbols = mockPrewarmTechnical.mock.calls.map(c => c[0]);
        expect(calledSymbols).toHaveLength(6);
        for (const s of ['S8', 'S9', 'S0', 'S1', 'S2', 'S3']) {
            expect(calledSymbols).toContain(s);
        }
        for (const s of ['S4', 'S5', 'S6', 'S7']) {
            expect(calledSymbols).not.toContain(s);
        }
    });

    // 2026-07-26 인시던트 회귀 가드.
    // 이전 구현은 offset을 freshCount(= universe - stale)에서 뽑았다. 창 안 후보가
    // 전부 blocked면 아무것도 완료되지 않아 freshCount가 얼어붙고, 그러면 offset도
    // 얼어붙어 다음 tick이 같은 창을 재검사한다 — 스스로 못 빠져나오는 livelock.
    // 실제 운영에서 `submitted:0 / remaining:153`이 반복되며 221/295에서 정지했다.
    // 시각 기반 offset은 진행 여부와 무관하게 창을 전진시키므로 반드시 통과한다.
    it('창이 전부 blocked여도 다음 tick엔 다른 창을 본다(livelock 회귀 가드)', async () => {
        const staleOnes: PrewarmSymbol[] = Array.from(
            { length: 40 },
            (_, i) => ({
                symbol: `S${i}`,
                tabs: ['technical'] as SeoSnapshotTab[],
            })
        );
        universe(...staleOnes);
        mockFindGeneratedAtMap.mockResolvedValue(new Map());
        mockPrewarmTechnical.mockResolvedValue({
            status: 'cached',
            result: {},
        });

        const TICK_MS = 5 * 60 * 1000;
        await runPrewarmBatch(makeSimClock(0 * TICK_MS));
        const first = mockPrewarmTechnical.mock.calls.map(c => c[0]);
        mockPrewarmTechnical.mockClear();

        // 진행이 전혀 없었다고 가정(스냅샷 맵 그대로 = freshCount 불변)해도
        // 다음 tick은 다른 심볼 집합을 선택해야 한다.
        await runPrewarmBatch(makeSimClock(1 * TICK_MS));
        const second = mockPrewarmTechnical.mock.calls.map(c => c[0]);

        expect(second).toHaveLength(6);
        expect(second).not.toEqual(first);
        expect(second.some(s => !first.includes(s))).toBe(true);
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

    it('in-flight 마커가 있는 탭은 seam을 호출하지 않고 건너뛴다', async () => {
        // 같은 (symbol, tab)을 두 tick이 동시에 LLM에 태우지 않게 막는 가드.
        universe({ symbol: 'INFLIGHT', tabs: ['technical'] });
        mockGetInFlightMarker.mockResolvedValue({ present: true });
        mockPrewarmTechnical.mockResolvedValue({
            status: 'cached',
            result: {},
        });

        const counts = await runPrewarmBatch();

        expect(mockPrewarmTechnical).not.toHaveBeenCalled();
        expect(counts.harvested).toBe(0);
    });

    it('선별 이후에 in-flight 마커가 생기면 그 탭은 seam을 호출하지 않는다', async () => {
        // classifySymbol이 통과시킨 뒤 processSymbol이 다시 확인하는 이유 — 두 시점
        // 사이에 다른 tick이 같은 (symbol, tab)을 잡을 수 있다. 이 가드가 없으면
        // 같은 유닛에 LLM이 두 번 태워진다.
        universe({ symbol: 'RACED', tabs: ['technical'] });
        let call = 0;
        mockGetInFlightMarker.mockImplementation(async () => {
            call++;
            // 1회차(선별)는 비어 있고, 2회차(처리)에는 마커가 생겨 있다.
            return call === 1
                ? { present: false, jobId: null }
                : { present: true, jobId: null };
        });
        mockPrewarmTechnical.mockResolvedValue({
            status: 'cached',
            result: {},
        });

        const counts = await runPrewarmBatch();

        expect(mockPrewarmTechnical).not.toHaveBeenCalled();
        // seam이 하나도 안 돌았으므로 FMP 예산도 가산하지 않는다.
        expect(mockAddFmpBudget).not.toHaveBeenCalled();
        expect(counts.harvested).toBe(0);
    });

    it('탭 데드라인으로 버린 작업은 counts.remaining과 로그에 남는다', async () => {
        // 조용히 건너뛰기만 하면 커버리지가 야금야금 줄어드는 걸 볼 방법이 없다 —
        // CloudWatch 알람이 이 마커에 걸려 있어서, 로그가 없으면 알람도 영원히 안 뜬다.
        universe({ symbol: 'MULTI', tabs: ['technical', 'fundamental'] });
        mockPrewarmTechnical.mockResolvedValue({
            status: 'cached',
            result: {},
        });
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const base = FIXED_NOW.getTime();
        const now = (): number =>
            mockPrewarmTechnical.mock.calls.length >= 1
                ? base + BATCH_DEADLINE_MS + 1
                : base;

        const counts = await runPrewarmBatch({
            now,
            sleep: vi.fn().mockResolvedValue(undefined),
        });

        expect(counts.remaining).toBeGreaterThan(0);
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('[seo-prewarm] batch deadline reached')
        );

        warnSpy.mockRestore();
    });

    it('탭 사이에서 데드라인을 넘기면 남은 탭을 중단한다', async () => {
        // 유닛 하나가 LLM 왕복만큼 블로킹하므로 청크 경계 검사만으로는 락 TTL을
        // 넘길 수 있다 — 탭 경계에서도 끊어야 한다.
        universe({ symbol: 'MULTI', tabs: ['technical', 'fundamental'] });
        mockPrewarmTechnical.mockResolvedValue({
            status: 'cached',
            result: {},
        });
        mockPrewarmFundamental.mockResolvedValue({
            status: 'cached',
            result: {},
        });

        const base = FIXED_NOW.getTime();
        // technical 탭이 끝난 뒤부터 데드라인을 넘긴 것으로 본다.
        const now = (): number =>
            mockPrewarmTechnical.mock.calls.length >= 1
                ? base + BATCH_DEADLINE_MS + 1
                : base;

        await runPrewarmBatch({
            now,
            sleep: vi.fn().mockResolvedValue(undefined),
        });

        expect(mockPrewarmTechnical).toHaveBeenCalledTimes(1);
        expect(mockPrewarmFundamental).not.toHaveBeenCalled();
    });

    it('크립토 심볼은 탭당 FMP 호출 추정치를 주식과 다르게 잡는다', async () => {
        // FMP 예산 집계가 자산군을 구분하지 않으면 크립토 배치의 사용량이 과대 계상돼
        // 예산 알람이 잘못 뜬다.
        universe({ symbol: 'BTCUSD', tabs: ['technical'] });
        mockPrewarmTechnical.mockResolvedValue({
            status: 'cached',
            result: {},
        });

        const cryptoCounts = await runPrewarmBatch();
        const cryptoBudgetCall = mockAddFmpBudget.mock.calls[0]?.[0] as number;

        // 두 번째 배치를 위해 기본 목 상태를 되돌린다(clearAllMocks는 호출 기록만 지운다).
        mockAddFmpBudget.mockClear();
        universe({ symbol: 'AAPL', tabs: ['technical'] });

        const equityCounts = await runPrewarmBatch();

        const equityBudgetCall = mockAddFmpBudget.mock.calls[0]?.[0] as number;
        expect(cryptoBudgetCall).toBeLessThan(equityBudgetCall);
        // counts 자체는 getFmpBudgetUsed 목이 0을 주므로 동일하다 — 자산군 구분은
        // addFmpBudget에 넘기는 추정치에서 드러난다.
        expect(cryptoCounts.harvested).toBe(equityCounts.harvested);
    });

    // ── FIX G(감사) — 배치 wall-clock 데드라인 ──

    it('청크 진입 시 데드라인을 넘겼으면 그 청크를 통째로 건너뛰고 로그를 남긴다', async () => {
        // SYMBOLS_PER_TICK === SYMBOL_CONCURRENCY(=6)이라 현재 상수 조합에서는 배치가
        // 항상 1청크다. 이 검사는 두 상수가 다시 갈라질 때를 위한 가드이므로, 시계를
        // 청크 진입 직전에 앞당겨 그 경로를 직접 태운다.
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
        // 1=배치 데드라인 계산, 2=회전 오프셋, 3번째부터(=청크0 진입 검사) 초과.
        const now = (): number => {
            calls++;
            return calls <= 2 ? base : base + BATCH_DEADLINE_MS + 1;
        };
        const sleep = vi.fn().mockResolvedValue(undefined);

        const counts = await runPrewarmBatch({ now, sleep });

        expect(mockPrewarmTechnical).not.toHaveBeenCalled();
        expect(counts.remaining).toBe(6);
        expect(warnSpy).toHaveBeenCalledWith(
            '[seo-prewarm] batch deadline reached — 0 symbols processed, 6 remaining'
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

    // ── run* 블로킹 결과 — 콜드 캐시 워밍 회귀 가드 ──

    it('seam이 done을 반환하면 upsert가 일어나고 counts.harvested가 증가한다', async () => {
        universe({ symbol: 'COLD', tabs: ['technical'] });
        mockPrewarmTechnical.mockResolvedValue({
            status: 'done',
            result: { warmed: true },
        });

        const counts = await runPrewarmBatch();

        expect(mockUpsert).toHaveBeenCalledWith(
            expect.objectContaining({
                symbol: 'COLD',
                tab: 'technical',
                content: { warmed: true },
            })
        );
        expect(counts.harvested).toBe(1);
    });

    it('seam이 throw하면 해당 유닛만 격리되고 배치는 계속 진행한다(fail-open)', async () => {
        universe({ symbol: 'SEAM_THROW', tabs: ['technical'] });
        mockPrewarmTechnical.mockRejectedValue(new Error('seam boom'));
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const counts = await runPrewarmBatch();

        expect(errSpy).toHaveBeenCalledWith(
            '[seo-prewarm] unit-error SEAM_THROW:technical',
            expect.any(Error)
        );
        expect(counts.harvested).toBe(0);
        errSpy.mockRestore();
    });

    it('seam이 status=error를 반환하면 terminal skip 처리되고 배치는 계속 진행한다', async () => {
        universe({ symbol: 'SEAM_BAD', tabs: ['technical'] });
        mockPrewarmTechnical.mockResolvedValue({
            status: 'error',
            code: 'fetch_failed',
            error: 'worker failed',
        });
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const counts = await runPrewarmBatch();

        expect(mockMarkSkipped).toHaveBeenCalledWith('SEAM_BAD', 'technical');
        expect(counts.harvested).toBe(0);

        warnSpy.mockRestore();
    });

    // ── FIX 1(감사) — 유닛 타임아웃 ──

    it('FIX 1 — seam이 UNIT_TIMEOUT_MS 내에 반환하지 않으면 포기하고 backoff 마커를 남긴다', async () => {
        // sim clock: sleep이 즉시 advance되므로 타임아웃이 즉각 발동한다.
        // seam은 절대 resolve되지 않는 프로미스를 반환해 "hung LLM call"을 시뮬레이션.
        universe({ symbol: 'HUNG', tabs: ['technical'] });
        mockPrewarmTechnical.mockReturnValue(new Promise(() => {}));
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const clock = makeSimClock(FIXED_NOW.getTime());
        const counts = await runPrewarmBatch(clock);

        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('[seo-prewarm] unit-timeout HUNG:technical')
        );
        expect(mockMarkSkipped).toHaveBeenCalledWith('HUNG', 'technical', 1800);
        // clearInFlight는 finally 블록에서 타임아웃 경로에도 반드시 호출된다.
        expect(mockClearInFlight).toHaveBeenCalledWith('HUNG', 'technical');
        expect(counts.harvested).toBe(0);

        warnSpy.mockRestore();
    });

    it('FIX 1 — 타임아웃된 탭 이후 다음 탭은 정상 처리된다(배치 중단 없음)', async () => {
        universe({ symbol: 'HUNG2', tabs: ['technical', 'overall'] });
        // technical만 타임아웃, overall은 정상 완료.
        mockPrewarmTechnical.mockReturnValue(new Promise(() => {}));
        mockPrewarmOverall.mockResolvedValue({ status: 'cached', result: {} });
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const clock = makeSimClock(FIXED_NOW.getTime());
        const counts = await runPrewarmBatch(clock);

        expect(mockMarkSkipped).toHaveBeenCalledWith(
            'HUNG2',
            'technical',
            1800
        );
        expect(mockPrewarmOverall).toHaveBeenCalled();
        // overall만 harvest.
        expect(counts.harvested).toBe(1);

        warnSpy.mockRestore();
    });

    // ── FIX 2(감사) — throw 시 backoff 마커 ──

    it('FIX 2 — throw(비-402)에서 짧은 backoff 마커를 남긴다(매 tick 무한 재시도 방지)', async () => {
        universe({ symbol: 'THROWSYM', tabs: ['technical'] });
        mockPrewarmTechnical.mockRejectedValue(new Error('content filter'));
        mockGetFmpErrorStatus.mockReturnValue(null);
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await runPrewarmBatch();

        // TTL은 기본 6시간이 아니라 30분이어야 한다 — throw의 대다수가 프로바이더
        // 장애 같은 일시적 실패라, 6시간을 걸면 짧은 장애가 prewarm을 반나절 세운다.
        expect(mockMarkSkipped).toHaveBeenCalledWith(
            'THROWSYM',
            'technical',
            1800
        );

        errSpy.mockRestore();
    });

    it('FIX 2 — FMP 402 에러는 backoff 마커를 남기지 않는다(플랜 변경 시 자동 재시도 가능)', async () => {
        universe({ symbol: '402SYM', tabs: ['technical'] });
        const err402 = new Error('FMP /profile 402');
        mockPrewarmTechnical.mockRejectedValue(err402);
        mockGetFmpErrorStatus.mockImplementation(err =>
            err === err402 ? 402 : null
        );
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await runPrewarmBatch();

        expect(mockMarkSkipped).not.toHaveBeenCalled();

        errSpy.mockRestore();
    });
});
