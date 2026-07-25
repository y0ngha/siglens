const {
    mockIsInFlight,
    mockMarkInFlight,
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
    mockBuildPrewarmUniverse,
} = vi.hoisted(() => ({
    mockIsInFlight: vi.fn(),
    mockMarkInFlight: vi.fn(),
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
    mockBuildPrewarmUniverse: vi.fn(),
}));

vi.mock('../lock', () => ({
    isInFlight: mockIsInFlight,
    markInFlight: mockMarkInFlight,
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
}));

vi.mock('@/entities/news-article/api', () => ({
    prewarmNews: mockPrewarmNews,
}));

vi.mock('@/entities/options-chain/api', () => ({
    prewarmOptions: mockPrewarmOptions,
}));

import type { SeoSnapshotTab } from '@/entities/seo-snapshot';
import type { PrewarmSymbol } from '@/entities/seo-snapshot/lib/applicability';
import { lastCompletedEtCloseWithBuffer } from '@/entities/seo-snapshot/lib/freshness';
import { runPrewarmBatch } from '../runPrewarmBatch';

const FIXED_NOW = new Date('2026-07-25T13:00:00.000Z');
const BOUNDARY = lastCompletedEtCloseWithBuffer(FIXED_NOW);
const STALE_DATE = new Date(BOUNDARY.getTime() - 24 * 60 * 60 * 1000);

function universe(...symbols: PrewarmSymbol[]): void {
    mockBuildPrewarmUniverse.mockReturnValue(symbols);
}

function key(symbol: string, tab: SeoSnapshotTab): string {
    return `${symbol}:${tab}`;
}

describe('runPrewarmBatch', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(FIXED_NOW);

        mockFindGeneratedAtMap.mockResolvedValue(new Map());
        mockIsInFlight.mockResolvedValue(false);
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

    it('submitted 결과는 markInFlight만 하고 upsert하지 않는다', async () => {
        universe({ symbol: 'NVDA', tabs: ['technical'] });
        mockPrewarmTechnical.mockResolvedValue({
            status: 'submitted',
            jobId: 'job-1',
        });

        const counts = await runPrewarmBatch();

        expect(mockMarkInFlight).toHaveBeenCalledWith('NVDA', 'technical');
        expect(mockUpsert).not.toHaveBeenCalled();
        expect(counts.submitted).toBe(1);
        expect(counts.harvested).toBe(0);
        expect(counts.revalidated).toBe(0);
    });

    it('overall의 pending_dependencies는 submitted와 동일하게 처리한다', async () => {
        universe({ symbol: 'TSLA', tabs: ['overall'] });
        mockPrewarmOverall.mockResolvedValue({
            status: 'pending_dependencies',
            pendingJobs: {},
        });

        const counts = await runPrewarmBatch();

        expect(mockMarkInFlight).toHaveBeenCalledWith('TSLA', 'overall');
        expect(mockUpsert).not.toHaveBeenCalled();
        expect(counts.submitted).toBe(1);
        expect(counts.harvested).toBe(0);
    });

    it('in-flight인 탭은 스킵하고 seam을 호출하지 않는다', async () => {
        universe({ symbol: 'GOOGL', tabs: ['technical'] });
        mockIsInFlight.mockResolvedValue(true);

        const counts = await runPrewarmBatch();

        expect(mockPrewarmTechnical).not.toHaveBeenCalled();
        expect(mockMarkInFlight).not.toHaveBeenCalled();
        expect(counts.submitted).toBe(0);
        expect(counts.harvested).toBe(0);
        // 유일한 stale 탭이 in-flight 스킵 → seam 실행 0건 → FMP 예산 0 추가.
        expect(mockAddFmpBudget).not.toHaveBeenCalled();
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

    it('SYMBOLS_PER_TICK(10)을 초과하면 나머지는 remaining으로 잡힌다', async () => {
        const symbols: PrewarmSymbol[] = Array.from({ length: 15 }, (_, i) => ({
            symbol: `SYM${i}`,
            tabs: ['technical'] as SeoSnapshotTab[],
        }));
        universe(...symbols);
        mockPrewarmTechnical.mockResolvedValue({
            status: 'submitted',
            jobId: 'job',
        });

        const counts = await runPrewarmBatch();

        expect(mockPrewarmTechnical).toHaveBeenCalledTimes(10);
        expect(counts.remaining).toBe(5);
    });

    it('options seam이 null을 반환하면 스킵하고 upsert하지 않는다', async () => {
        universe({ symbol: 'D', tabs: ['options'] });
        mockPrewarmOptions.mockResolvedValue(null);

        const counts = await runPrewarmBatch();

        expect(mockUpsert).not.toHaveBeenCalled();
        expect(mockMarkInFlight).not.toHaveBeenCalled();
        expect(counts.submitted).toBe(0);
        expect(counts.harvested).toBe(0);
        expect(counts.revalidated).toBe(0);
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

    it('한 심볼의 일부 탭이 stale로 남으면 revalidate하지 않는다', async () => {
        universe({ symbol: 'G', tabs: ['technical', 'overall'] });
        mockPrewarmTechnical.mockResolvedValue({
            status: 'cached',
            result: {},
        });
        mockPrewarmOverall.mockResolvedValue({
            status: 'submitted',
            jobId: 'job',
        });

        const counts = await runPrewarmBatch();

        expect(counts.harvested).toBe(1);
        expect(counts.submitted).toBe(1);
        expect(mockRevalidateTag).not.toHaveBeenCalled();
        expect(counts.revalidated).toBe(0);
    });
});
