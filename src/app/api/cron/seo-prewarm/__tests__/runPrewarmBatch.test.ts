const {
    mockIsInFlight,
    mockMarkInFlight,
    mockAddFmpBudget,
    mockGetFmpBudgetUsed,
    mockRevalidateTag,
    mockRevalidatePath,
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
    mockRevalidatePath: vi.fn(),
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
    revalidatePath: mockRevalidatePath,
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

vi.mock('@/entities/analysis/lib/prewarmSubmits', () => ({
    prewarmTechnical: mockPrewarmTechnical,
    prewarmOverall: mockPrewarmOverall,
    prewarmFundamental: mockPrewarmFundamental,
    prewarmFinancials: mockPrewarmFinancials,
    prewarmCongress: mockPrewarmCongress,
}));

vi.mock('@/entities/news-article/lib/prewarmSubmitNews', () => ({
    prewarmNews: mockPrewarmNews,
}));

vi.mock('@/entities/options-chain/lib/prewarmSubmitOptions', () => ({
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
        expect(mockRevalidatePath).toHaveBeenCalledWith('/MSFT');
        expect(mockRevalidatePath).toHaveBeenCalledWith('/MSFT/overall');
        expect(counts.revalidated).toBe(1);
        expect(mockAddFmpBudget).toHaveBeenCalledWith(22);
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

    it('크립토 심볼은 FMP 예산을 2로 계상한다', async () => {
        universe({ symbol: 'BTCUSD', tabs: ['technical'] });
        mockPrewarmTechnical.mockResolvedValue({
            status: 'cached',
            result: {},
        });

        await runPrewarmBatch();

        expect(mockAddFmpBudget).toHaveBeenCalledWith(2);
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
