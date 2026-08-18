const {
    mockMarkInFlight,
    mockGetInFlightMarker,
    mockIsSkipped,
    mockMarkSkipped,
    mockClearInFlight,
    mockAddFmpBudget,
    mockGetFmpBudgetUsed,
    mockAdvanceRotationCursor,
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
    mockAdvanceRotationCursor: vi.fn(),
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
    advanceRotationCursor: mockAdvanceRotationCursor,
    // 구현과 동일한 값(lock.ts). 일시적 실패 backoff TTL.
    TRANSIENT_SKIP_TTL_SECONDS: 1800,
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

// `buildPrewarmUniverse`만 스텁하고 나머지는 실물을 쓴다. `prewarmSessionSpecFor`는
// `freshness`의 장중 게이트가 부르는데, 스텁으로 덮으면 "크립토는 절대 미루지 않는다"는
// 계약이 이 스위트에서 사라진다 — 그 계약이 깨져도 여기 36개 테스트가 전부 통과한다.
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
import {
    lastCompletedEtCloseWithBuffer,
    isSnapshotFresh as isSnapshotFreshReal,
    snapshotCloseBoundaryFor as snapshotCloseBoundaryForReal,
    shouldDeferPrewarmWhileOpen as shouldDeferPrewarmWhileOpenReal,
} from '@/entities/seo-snapshot/lib/freshness';
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
        // 회전에 관심 없는 테스트의 기본값 — offset은 항상 0(창의 시작)이다.
        // 회전 자체를 검증하는 테스트는 이 mock을 로컬로 덮어쓴다.
        mockAdvanceRotationCursor.mockResolvedValue(0);
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

    // ── FIX A/2026-08 감사 — 공정 선별: 회전 오프셋 + resumable 우선 + backoff 배제 ──

    /** 실제 Redis INCRBY 시맨틱을 그대로 흉내: 호출마다 `step`만큼 전진하고
     * "전진 전" 값을 반환한다. `advanceRotationCursor`의 계약과 동일하다. */
    function makeStatefulRotationCursor(
        startValue = 0
    ): (step: number) => Promise<number> {
        let cursor = startValue;
        return async (step: number) => {
            const base = cursor;
            cursor += step;
            return base;
        };
    }

    it('회전 오프셋 — Redis 영속 커서에서 결정적으로 파생된다(시각·Math.random과 무관)', async () => {
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

        // advanceRotationCursor는 "전진 전"(=이번 tick이 쓸) 값을 반환한다.
        // 8을 주면 offset = 8 % 10 = 8 → S8,S9,S0..S3이 선택된다.
        mockAdvanceRotationCursor.mockResolvedValue(8);

        await runPrewarmBatch();

        expect(mockAdvanceRotationCursor).toHaveBeenCalledWith(6); // SYMBOLS_PER_TICK
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
    // 이전(첫 번째) 구현은 offset을 freshCount(= universe - stale)에서 뽑았다. 창 안
    // 후보가 전부 blocked면 아무것도 완료되지 않아 freshCount가 얼어붙고, 그러면
    // offset도 얼어붙어 다음 tick이 같은 창을 재검사한다 — 스스로 못 빠져나오는 livelock.
    // 실제 운영에서 `submitted:0 / remaining:153`이 반복되며 221/295에서 정지했다.
    // 지금(2026-08 감사) 구현은 "완료 여부"가 아니라 "실행 횟수"에 오프셋을 묶는다 —
    // advanceRotationCursor는 selectFairBatch가 호출되기만 하면 분류 결과와 무관하게
    // 전진하므로 이 livelock이 재발할 수 없다.
    it('창이 전부 blocked여도 커서가 무조건 전진해 다음 tick엔 다른 창을 본다(livelock 회귀 가드)', async () => {
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
        mockAdvanceRotationCursor.mockImplementation(
            makeStatefulRotationCursor(0)
        );

        // tick 1 — 창의 전부를 blocked로 만든다(모든 후보가 in-flight).
        mockGetInFlightMarker.mockResolvedValue({ present: true, jobId: null });
        await runPrewarmBatch();
        expect(mockPrewarmTechnical).not.toHaveBeenCalled();

        // tick 2 — 이제는 아무것도 막혀 있지 않다고 가정한다. 진행이 전혀 없었는데도
        // (tick 1에서 아무것도 완료되지 않았다) 커서는 실행 자체로 전진했으므로,
        // tick 1과 겹치지 않는 새 창(offset=6)을 봐야 한다.
        mockGetInFlightMarker.mockResolvedValue({
            present: false,
            jobId: null,
        });
        await runPrewarmBatch();
        const second = mockPrewarmTechnical.mock.calls.map(c => c[0]);

        expect(second).toEqual(['S6', 'S7', 'S8', 'S9', 'S10', 'S11']);
    });

    // 2026-08 감사(KR 5종목 prewarm 미도달의 근본 원인) 회귀 가드.
    // 이전(두 번째) 구현은 offset을 tick 시각에서 파생했다 — 배치 하나가 지연되면
    // 다음 실제 실행 시각이 몇 틱 밀리고, 그만큼 offset이 경과 시간에 비례해
    // 점프했다. 여기서는 그 지연을 그대로 재현한다: tick 1과 tick 2 사이에 실제
    // wall-clock이 4틱(20분)만큼 흘렀다고 가정한다(FMP 폭풍으로 배치 하나가
    // BATCH_DEADLINE_MS+스케줄 주기를 다 쓴 뒤에도 그다음 tick조차 락 때문에
    // 건너뛴 시나리오). 이전 구현이라면 offset이 floor(20분/5분)×6=24로 뛰어(창
    // 폭 18을 넘어) S18~S23 대역이 한동안 후보가 되지 못했다 — 그 뒤로도 회전
    // 시각이 계속 옛 offset과 어긋나므로 "다음에 자연스럽게 따라잡는다"가 보장되지
    // 않는다. 새 구현은 시각과 무관하므로 그 대역이 "밀린 tick 바로 다음"에
    // 정확히 예정대로 도착해야 한다.
    it('배치 오버런으로 여러 tick이 밀려도 다음 tick들이 대역을 건너뛰지 않는다(overrun-no-skip 회귀 가드)', async () => {
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
        // 커서는 "실행 횟수"에만 묶인다 — 아래에서 clock을 4틱만큼 앞당겨도 이
        // mock의 전진 폭에는 아무 영향이 없다(그 자체가 FIX B의 핵심 주장이다).
        mockAdvanceRotationCursor.mockImplementation(
            makeStatefulRotationCursor(0)
        );

        const TICK_MS = 5 * 60 * 1000;
        // tick 1 — 정상 시각. offset=0 → S0~S5.
        await runPrewarmBatch(makeSimClock(0));
        mockPrewarmTechnical.mockClear();

        // tick 2 — 배치 하나가 데드라인(600s)+스케줄(300s)을 다 써 다음 실제
        // 실행이 4틱(20분) 뒤에야 시작됐다고 가정한다. offset=6 → S6~S11
        // (옛 구현이라면 offset이 24로 뛰어 S24~S29를 봤을 시점).
        await runPrewarmBatch(makeSimClock(4 * TICK_MS));
        mockPrewarmTechnical.mockClear();

        // tick 3 — offset=12 → S12~S17.
        await runPrewarmBatch(makeSimClock(4 * TICK_MS));
        mockPrewarmTechnical.mockClear();

        // tick 4 — offset=18 → S18~S23. 옛 구현이라면 tick 2의 24-점프 때문에
        // 이 대역이 이 시점에 나타나지 않았다(다음 도달은 회전 주기 전체를
        // 기다려야 했다).
        await runPrewarmBatch(makeSimClock(4 * TICK_MS));
        const fourth = mockPrewarmTechnical.mock.calls.map(c => c[0]);

        expect(fourth).toEqual(['S18', 'S19', 'S20', 'S21', 'S22', 'S23']);
    });

    // review(2026-08) 회귀 가드 — selectFairBatch doc-comment(①)이 "이전 창과 바로
    // 이어 붙는다"고 주장하는 대상은 offset = base % staleSymbols.length인데, 위
    // 세 테스트는 전부 **정적** 배열(길이·구성이 tick 사이에 안 바뀜) 위에서 커서만
    // 바꿔가며 검증한다. 실제로는 그 배열(정확히는 selectFairBatch가 받는
    // `selectable`)이 매 tick 바뀐다 — 완료된 심볼이 stale에서 빠지고, 마감 경계가
    // 자정을 넘기면 유니버스 전체가 되살아나고(nightly reset), KR 블록은
    // kr-boundary window(00:00~03:59 UTC = 09:00~12:59 KST)에서
    // `shouldDeferPrewarmWhileOpen`에 걸려 selectable에서 빠졌다가 장이 끝나면
    // 되돌아온다(실제 KR 5종목 인시던트가 일어난 정확히 그 구간). 이 세 축(길이
    // 변화·자정 리셋·KR defer/reinclude) 중 어느 것도 고정하지 않은 상태에서 이
    // 불변식을 pin한다.
    //
    // 검증 방식은 shadow model이다: `predictBatch`는 selectFairBatch의 회전
    // 산술(offset = base % length, 그 지점부터 SYMBOLS_PER_TICK개 슬라이스)만
    // 재구현한다 — freshness·defer 판정은 재구현하지 않고 실물 함수
    // (`isSnapshotFreshReal`/`snapshotCloseBoundaryForReal`/
    // `shouldDeferPrewarmWhileOpenReal`, `@/entities/seo-snapshot/lib/freshness`는
    // 이 파일에서 mock되지 않는다)를 그대로 불러 쓴다. `base`는 실제 실행이 그
    // tick에 advanceRotationCursor로부터 받은 값을 그대로 가져온다(재계산하지
    // 않음) — 그래서 이 테스트가 검증하는 것은 정확히 "그 base와 그 tick의 실제
    // selectable로부터 나와야 할 6개"뿐이다. 모듈로가 stale length를 쓰거나
    // 커서가 매 실행 리셋되면 실제 선택이 이 예측과 tick마다 어긋나 즉시 실패한다.
    it('staleSymbols가 완료·자정 리셋·KR defer로 매 tick 실제로 바뀌어도 회전이 전 심볼을 빠짐없이 커버한다(동적 배열 회귀 가드)', async () => {
        const KR_BLOCK = Array.from(
            { length: 5 },
            (_, i) => `00000${i + 1}.KS`
        ); // POPULAR_TICKERS의 KR 블록 head를 그대로 흉내(실제 인시던트 모양).
        const US_BLOCK = Array.from({ length: 20 }, (_, i) => `US${i + 1}`);
        const universeSymbols = [...KR_BLOCK, ...US_BLOCK];
        universe(
            ...universeSymbols.map(symbol => ({
                symbol,
                tabs: ['technical'] as SeoSnapshotTab[],
            }))
        );
        mockPrewarmTechnical.mockResolvedValue({
            status: 'cached',
            result: {},
        });

        // 실제 Redis INCRBY를 흉내내되(makeStatefulRotationCursor와 동일 계약),
        // 이 tick이 실제로 받은 base를 예측 계산에 쓸 수 있도록 기록해 둔다.
        let cursor = 0;
        let lastBase = 0;
        mockAdvanceRotationCursor.mockImplementation(async (step: number) => {
            lastBase = cursor;
            cursor += step;
            return lastBase;
        });

        // 테스트가 직접 들고 있는 generatedAt 북키핑 — 실물 DB의
        // findGeneratedAtMap을 흉내낸다. 한 번 선택된 심볼은 선택된 tick 시각을
        // generatedAt으로 기록하고, 그 뒤로는 실물 isSnapshotFreshReal이 boundary와
        // 비교해 stale 여부를 스스로 판정한다 — nightly reset도, KR/US 경계
        // 롤오버도 실물 로직이 처리하므로 이 테스트가 따로 흉내내지 않는다.
        const generatedAtBySymbol = new Map<string, Date>();

        function computeSelectableOracle(now: Date): string[] {
            return universeSymbols.filter(symbol => {
                const boundary = snapshotCloseBoundaryForReal(symbol, now);
                const fresh = isSnapshotFreshReal(
                    generatedAtBySymbol.get(symbol),
                    boundary
                );
                if (fresh) return false; // stale에서 빠짐 → selectable에서도 빠짐.
                return !shouldDeferPrewarmWhileOpenReal(symbol, now); // KR defer.
            });
        }

        // selectFairBatch의 회전 산술만 재구현(위 doc-comment 참고). windowSize
        // 캡(CANDIDATE_WINDOW_MULTIPLIER)은 blocked 후보가 없는 이 테스트에서는
        // 결과에 영향이 없다 — fresh = window 전체이고 batch는 그 앞 6개뿐이라,
        // 그 6개는 windowSize와 무관하게 항상 selectable[(offset+i) % length]다.
        function predictBatch(selectable: string[], base: number): string[] {
            if (selectable.length === 0) return [];
            const offset = base % selectable.length;
            const size = Math.min(6, selectable.length); // SYMBOLS_PER_TICK
            return Array.from(
                { length: size },
                (_, i) => selectable[(offset + i) % selectable.length]
            );
        }

        function nightTicks(nightStartIso: string): Date[] {
            const HALF_HOUR = 30 * 60 * 1000;
            const start = new Date(nightStartIso).getTime();
            const ticks: Date[] = [];
            // early region: 20:30~23:30 UTC(7틱) — KR 개장 전, 전 유니버스가 후보.
            for (let i = 0; i < 7; i++)
                ticks.push(new Date(start + i * HALF_HOUR));
            // kr-boundary window: 00:00~03:30 UTC(다음날, 09:00~12:30 KST, 8틱) — KR
            // 블록이 shouldDeferPrewarmWhileOpen에 걸려 selectable에서 빠진다.
            const krStart = start + 7 * HALF_HOUR;
            for (let i = 0; i < 8; i++)
                ticks.push(new Date(krStart + i * HALF_HOUR));
            return ticks;
        }

        // 평일 3일(2026-08-17~19, 화~수요일 KR 장중 걸침) — 미국·한국 모두 휴장일이
        // 아니다. 밤마다 마감 경계가 하루씩 굴러가 전날 harvest된 심볼도 다시
        // stale이 된다(nightly reset).
        const NIGHTS = [
            '2026-08-17T20:30:00.000Z',
            '2026-08-18T20:30:00.000Z',
            '2026-08-19T20:30:00.000Z',
        ];

        const selectedEver = new Set<string>();

        for (const [nightIndex, nightStart] of NIGHTS.entries()) {
            const selectedThisNight = new Set<string>();

            for (const tick of nightTicks(nightStart)) {
                vi.setSystemTime(tick);
                mockFindGeneratedAtMap.mockResolvedValue(
                    new Map(
                        [...generatedAtBySymbol].map(([symbol, date]) => [
                            key(symbol, 'technical'),
                            date,
                        ])
                    )
                );
                mockPrewarmTechnical.mockClear();

                const selectableOracle = computeSelectableOracle(tick);

                await runPrewarmBatch();

                const actual = mockPrewarmTechnical.mock.calls.map(
                    c => c[0] as string
                );
                const expected = predictBatch(selectableOracle, lastBase);

                expect(
                    actual,
                    `night ${nightIndex + 1} tick=${tick.toISOString()} base=${lastBase} selectable=[${selectableOracle.join(',')}]`
                ).toEqual(expected);

                for (const symbol of actual) {
                    generatedAtBySymbol.set(symbol, tick);
                    selectedThisNight.add(symbol);
                    selectedEver.add(symbol);
                }
            }

            // 밤마다 전 유니버스가 최소 한 번은 선택된다 — KR 블록이
            // kr-boundary window에서 빠졌다가 되돌아오는 것도, 완료된 심볼이
            // staleSymbols에서 빠지는 것도 이 커버리지를 깨지 않아야 한다.
            const missing = universeSymbols.filter(
                s => !selectedThisNight.has(s)
            );
            expect(
                missing,
                `night ${nightIndex + 1} missed: ${missing.join(', ')}`
            ).toEqual([]);
        }

        // 전체 실행에서 한 번도 선택되지 못한 심볼이 없다 — "다른 심볼은 반복
        // 선택되는데 특정 심볼만 영영 선택 안 됨"이 이 테스트가 잡는 회귀 모양이다.
        expect(selectedEver.size).toBe(universeSymbols.length);
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
        // status:'error'는 FMP fetch 실패 등 일시적 실패라 30분 backoff다.
        expect(mockMarkSkipped).toHaveBeenCalledWith(
            'ERRSYM',
            'technical',
            1800
        );

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

        // makeSimClock(경과 시간 clock)을 쓰되, "청크 진입 직전"이라는 named
        // checkpoint에서 데드라인을 넘긴다 — clock.now() 호출 횟수를 세지 않는다.
        // advanceRotationCursor는 selectFairBatch가 청크 루프에 들어가기 **직전**에
        // 정확히 한 번 호출되므로(runPrewarmBatch.ts) 그 시점을 hook해 clock을
        // 데드라인 너머로 진행시킨다. 이 방식은 now() 호출 지점이 앞으로 추가되거나
        // 없어져도(call-count 기반이라면 매번 threshold를 다시 맞춰야 한다) 깨지지
        // 않는다.
        const clock = makeSimClock(FIXED_NOW.getTime());
        mockAdvanceRotationCursor.mockImplementation(async () => {
            await clock.sleep(BATCH_DEADLINE_MS + 1);
            return 0;
        });

        const counts = await runPrewarmBatch(clock);

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

        expect(mockMarkSkipped).toHaveBeenCalledWith(
            'SEAM_BAD',
            'technical',
            1800
        );
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
        /**
         * Task 8: UNIT_TIMEOUT_MS 값 고정.
         *
         * `UNIT_TIMEOUT_MS`는 private 상수지만 처리 단위당 최대 비용을 결정한다.
         * 리팩터가 실수로 값을 바꿔도 기존 테스트는 "타임아웃이 발동했다"만 볼 뿐
         * 어떤 값으로 sleep이 호출됐는지 검증하지 않아 조용히 통과한다.
         * spy로 호출 인자를 단언해 120_000ms라는 계약을 고정한다.
         */
        vi.spyOn(clock, 'sleep');
        const counts = await runPrewarmBatch(clock);

        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('[seo-prewarm] unit-timeout HUNG:technical')
        );
        expect(mockMarkSkipped).toHaveBeenCalledWith('HUNG', 'technical', 1800);
        // clearInFlight는 finally 블록에서 타임아웃 경로에도 반드시 호출된다.
        expect(mockClearInFlight).toHaveBeenCalledWith('HUNG', 'technical');
        expect(counts.harvested).toBe(0);
        // Task 8: UNIT_TIMEOUT_MS = 120_000ms. 이 값을 올리면 타임아웃이 느려지고
        // 낮추면 정상 LLM 호출이 잘린다 — 리터럴로 단언해 실수를 잡는다.
        expect(clock.sleep).toHaveBeenCalledWith(120_000);

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

    /**
     * Task 7: counts.staleTotal / counts.durationMs 회귀 가드.
     *
     * 두 필드가 아예 없거나 초기화된 채로 반환돼도 기존 테스트는 검사하지 않는다.
     * - `staleTotal`을 누락하면 모니터링 알람의 근거가 사라진다.
     * - `durationMs`를 누락하면 배치 소요 시간 추적이 불가하다.
     */
    it('Task 7 — counts.staleTotal과 counts.durationMs가 올바르게 설정된다', async () => {
        // 3개의 stale 심볼. staleTotal은 처음부터 이 값으로 초기화된다.
        universe(
            { symbol: 'BULK1', tabs: ['technical'] },
            { symbol: 'BULK2', tabs: ['technical'] },
            { symbol: 'BULK3', tabs: ['technical'] }
        );
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: {
                symbol: 'BULK',
                name: 'Bulk Co.',
                fmpSymbol: undefined,
            },
            degraded: false,
        });
        mockPrewarmTechnical.mockResolvedValue({
            status: 'cached',
            result: {},
        });

        // makeSimClock: sleep 호출마다 t를 즉시 advance한다.
        const clock = makeSimClock(FIXED_NOW.getTime());
        const counts = await runPrewarmBatch(clock);

        // staleTotal은 runPrewarmBatch 진입 시 staleSymbols.length로 고정된다.
        expect(counts.staleTotal).toBe(3);
        // durationMs는 배치 시작 시각과 종료 시각의 차이다.
        // makeSimClock에서 sleep 호출마다 t가 advance되므로 0보다 크다.
        expect(counts.durationMs).toBeGreaterThan(0);
    });

    // ── 2026-08 감사 — starvation watch(회전에서 구조적으로 빠진 심볼을 로그로 노출) ──

    it('한 번도 생성된 적 없는(never) stale 심볼은 starvation watch 로그에 (never)로 찍힌다', async () => {
        // 이번 KR 5종목 인시던트의 모양 그대로 — generatedAtMap에 해당 키가 아예 없다.
        universe({ symbol: 'NEVERWARMED', tabs: ['technical'] });
        mockFindGeneratedAtMap.mockResolvedValue(new Map());
        mockPrewarmTechnical.mockResolvedValue({
            status: 'cached',
            result: {},
        });
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await runPrewarmBatch();

        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining(
                '[seo-prewarm] starvation watch: 1 symbol(s) stale > 48h — worst: NEVERWARMED(never)'
            )
        );

        warnSpy.mockRestore();
    });

    it('48시간 이내로 stale인 심볼은 starvation watch에 잡히지 않는다', async () => {
        // STALE_DATE(boundary - 24h)는 FIXED_NOW 기준 아직 48h 문턱 안이다 —
        // "오늘 밤 아직 순번이 안 왔다"일 뿐 구조적 starvation이 아니다.
        universe({ symbol: 'RECENTSTALE', tabs: ['technical'] });
        mockFindGeneratedAtMap.mockResolvedValue(
            new Map([[key('RECENTSTALE', 'technical'), STALE_DATE]])
        );
        mockPrewarmTechnical.mockResolvedValue({
            status: 'cached',
            result: {},
        });
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await runPrewarmBatch();

        expect(warnSpy).not.toHaveBeenCalledWith(
            expect.stringContaining('starvation watch')
        );

        warnSpy.mockRestore();
    });

    it('여러 offender가 있으면 가장 오래 밀린 순으로 상위 5개만 로그에 남기고 총 개수는 전체를 반영한다', async () => {
        // 7개 모두 never-generated. worst 목록은 STARVATION_LOG_LIMIT(5)로 잘리지만
        // 총 개수(7)는 전체를 센다 — 잘린 나머지도 여전히 문제라는 신호를 잃지 않는다.
        const symbols: PrewarmSymbol[] = Array.from({ length: 7 }, (_, i) => ({
            symbol: `NEVER${i}`,
            tabs: ['technical'] as SeoSnapshotTab[],
        }));
        universe(...symbols);
        mockFindGeneratedAtMap.mockResolvedValue(new Map());
        mockPrewarmTechnical.mockResolvedValue({
            status: 'cached',
            result: {},
        });
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await runPrewarmBatch();

        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining(
                '[seo-prewarm] starvation watch: 7 symbol(s) stale > 48h'
            )
        );
        const call = warnSpy.mock.calls.find(c =>
            String(c[0]).includes('starvation watch')
        );
        const message = String(call?.[0]);
        const worstOffenderCount = (message.match(/NEVER\d\(never\)/g) ?? [])
            .length;
        expect(worstOffenderCount).toBe(5);

        warnSpy.mockRestore();
    });

    /**
     * Task 9: processSymbol의 탭별 isSkipped 가드가 실제로 seam을 차단한다.
     *
     * 2탭 심볼에서 기술적(technical) 탭만 isSkipped=true로 만들고, overall 탭은
     * 정상 처리되는지 확인한다. 이 가드가 없으면 terminal backoff 마커를 무시하고
     * 매 배치마다 동일 분석을 재시도해 I/O 비용이 낭비된다.
     */
    it('Task 9 — isSkipped가 true인 탭의 seam은 호출되지 않고 다른 탭은 정상 처리된다', async () => {
        universe({ symbol: 'SKIPTEST', tabs: ['technical', 'overall'] });
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: {
                symbol: 'SKIPTEST',
                name: 'Skip Test Inc.',
                fmpSymbol: undefined,
            },
            degraded: false,
        });
        mockPrewarmOverall.mockResolvedValue({ status: 'cached', result: {} });

        // technical 탭만 isSkipped=true. overall은 false.
        mockIsSkipped.mockImplementation((_symbol: string, tab: string) =>
            Promise.resolve(tab === 'technical')
        );

        const counts = await runPrewarmBatch();

        // technical 탭은 isSkipped=true → seam 미호출.
        expect(mockPrewarmTechnical).not.toHaveBeenCalled();
        // overall 탭은 isSkipped=false → 정상 처리.
        expect(mockPrewarmOverall).toHaveBeenCalledWith(
            'SKIPTEST',
            'Skip Test Inc.',
            false
        );
        expect(counts.harvested).toBe(1);
    });

    /**
     * Task 4: alreadyFresh 검사가 isPastDeadline() 검사보다 먼저 실행된다.
     *
     * 두 블록의 순서를 바꾸면(isPastDeadline 먼저) 이미 fresh한 탭도 "데드라인으로
     * 버려짐"으로 계산되어 counts.remaining이 부풀고, 경고 메시지에 실제보다
     * 많은 탭 수가 찍힌다.
     *
     * 검증 방식(makeSimClock + named checkpoint — call-count 세지 않음):
     * - symbol ORDTEST: technical(fresh in map) + overall(stale).
     * - `getAssetInfoResilient`는 processSymbol이 탭 루프에 들어가기 **직전**에
     *   심볼당 정확히 한 번만 호출된다(runPrewarmBatch.ts) — 그 호출을 hook해
     *   그 시점에 clock을 데드라인 너머로 진행시킨다. 청크 진입 검사(그 앞에서
     *   일어남)는 자연히 데드라인 이전을 본다.
     * - 올바른 순서: technical → alreadyFresh → continue(isPastDeadline 미호출);
     *                 overall → alreadyFresh=false → isPastDeadline=true → dropped.
     *   → droppedByDeadline=1, counts.remaining=1, warn "1 tabs dropped".
     * - 잘못된 순서(isPastDeadline 먼저)라면: technical → isPastDeadline=true →
     *                 dropped(fresh 체크 안함); overall → isPastDeadline=true → dropped.
     *   → droppedByDeadline=2, counts.remaining=2, warn "2 tabs dropped".
     */
    it('Task 4 — alreadyFresh 검사가 isPastDeadline보다 먼저 실행된다(신선도 우선 순서 보장)', async () => {
        universe({ symbol: 'ORDTEST', tabs: ['technical', 'overall'] });
        mockFindGeneratedAtMap.mockResolvedValue(
            // technical은 이미 fresh, overall은 stale(맵에 없음).
            new Map([[key('ORDTEST', 'technical'), BOUNDARY]])
        );

        const clock = makeSimClock(FIXED_NOW.getTime());
        mockGetAssetInfoResilient.mockImplementation(async (symbol: string) => {
            // named checkpoint — processSymbol의 탭 루프 진입 직전. 청크 진입
            // 데드라인 검사는 이미 통과한 뒤이므로 여기서부터 넘겨도 안전하다.
            await clock.sleep(BATCH_DEADLINE_MS + 1);
            return {
                assetInfo: {
                    symbol,
                    name: 'Order Test Inc.',
                    fmpSymbol: undefined,
                },
                degraded: false,
            };
        });
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const counts = await runPrewarmBatch(clock);

        // 올바른 순서: fresh 탭(technical)은 isPastDeadline 없이 처리되므로
        // droppedByDeadline=1(overall만)이고, counts.remaining=1.
        // 잘못된 순서(deadline-first)에서는 remaining=2.
        expect(counts.remaining).toBe(1);
        expect(warnSpy).toHaveBeenCalledWith(
            '[seo-prewarm] batch deadline reached — 1 tabs dropped'
        );

        warnSpy.mockRestore();
    });
});
