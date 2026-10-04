/**
 * 프리웜 배치 → IndexNow 제출 배선 가드.
 *
 * 제출 함수(`submitIndexNow`)와 sitemap 입력 로더만 목으로 두고 `indexNowSubmission`은
 * 실물을 쓴다. 그래야 "새로 구운 심볼 → sitemap에 실린 URL"이라는 연결 전체가 검증된다.
 * 어느 쪽 배선이 빠져도(심볼 수집 누락, 허브 URL 누락, 호출 위치 이동) 아래 테스트가 깨진다.
 *
 * 이 크론은 운영에서 5분마다 돈다. 제출은 부가 임무라 **어떤 실패도 배치를 깨뜨리면
 * 안 된다** — 마지막 두 케이스가 그 계약이다.
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
    mockBuildPrewarmUniverse,
    mockRunHubPrewarm,
    mockSubmitIndexNow,
    mockIsIndexNowEnabled,
    mockLoadPopular,
    mockLoadCrypto,
    mockLoadStatic,
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
    mockBuildPrewarmUniverse: vi.fn(),
    mockRunHubPrewarm: vi.fn(),
    mockSubmitIndexNow: vi.fn(),
    mockIsIndexNowEnabled: vi.fn(),
    mockLoadPopular: vi.fn(),
    mockLoadCrypto: vi.fn(),
    mockLoadStatic: vi.fn(),
}));

vi.mock('../hubs', () => ({ runHubPrewarm: mockRunHubPrewarm }));

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
    prewarmFundamental: vi.fn(),
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

vi.mock('@/shared/lib/indexNow', () => ({
    submitIndexNow: mockSubmitIndexNow,
    isIndexNowEnabled: mockIsIndexNowEnabled,
}));

vi.mock('@/app/api/sitemap/_shared/childEntries', () => ({
    loadPopularChildEntries: mockLoadPopular,
    loadCryptoChildEntries: mockLoadCrypto,
    loadStaticChildEntries: mockLoadStatic,
}));

import { buildCryptoPopularEntries } from '@/entities/sitemap-entry/lib/buildCryptoPopularEntries';
import { buildPopularEntries } from '@/entities/sitemap-entry/lib/buildPopularEntries';
import { buildStaticEntries } from '@/entities/sitemap-entry/lib/buildStaticEntries';
import { INDEXNOW_ENDPOINTS } from '@/shared/config/indexNow';
import { SITE_URL } from '@/shared/lib/seo';
import { runPrewarmBatch } from '../runPrewarmBatch';

const NOW = new Date('2026-10-04T12:00:00.000Z');
const HUBS_NOTHING_GENERATED = {
    attempted: 0,
    generated: 0,
    alreadyFresh: 0,
    noData: 0,
    keyMismatch: 0,
    failed: 0,
    skippedByDeadline: 0,
    skippedByCooldown: 0,
    generatedUrls: [] as readonly string[],
};
const AAPL_URLS = [
    `${SITE_URL}/AAPL`,
    `${SITE_URL}/AAPL/news`,
    `${SITE_URL}/AAPL/fear-greed`,
];
const snapshotGeneratedAt = new Map<string, Date>([['AAPL:news', NOW]]);

/** 제출 호출의 URL 목록 — 호출이 정확히 한 번이라는 사실까지 함께 고정한다. */
function submittedUrls(): readonly string[] {
    expect(mockSubmitIndexNow).toHaveBeenCalledTimes(1);
    return mockSubmitIndexNow.mock.calls[0]?.[0] as readonly string[];
}

describe('runPrewarmBatch — IndexNow 제출', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
        vi.spyOn(console, 'error').mockImplementation(() => undefined);

        mockRunHubPrewarm.mockResolvedValue(HUBS_NOTHING_GENERATED);
        mockFindGeneratedAtMap.mockResolvedValue(new Map());
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
            result: {},
        });
        mockBuildPrewarmUniverse.mockReturnValue([
            { symbol: 'AAPL', tabs: ['technical'] },
        ]);

        mockIsIndexNowEnabled.mockReturnValue(true);
        mockSubmitIndexNow.mockResolvedValue({
            submitted: 3,
            ok: 1,
            failed: 0,
        });
        mockLoadPopular.mockResolvedValue(
            buildPopularEntries(NOW, { snapshotGeneratedAt })
        );
        mockLoadCrypto.mockResolvedValue(
            buildCryptoPopularEntries(NOW, { snapshotGeneratedAt })
        );
        mockLoadStatic.mockResolvedValue(buildStaticEntries(NOW));
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('심볼 하나를 새로 구워 반영했으면 그 심볼의 sitemap URL로 한 번 제출한다', async () => {
        const counts = await runPrewarmBatch();

        expect(counts.revalidated).toBe(1);
        expect(submittedUrls()).toEqual(AAPL_URLS);
    });

    it('제출 결과를 배치 카운트에 싣는다', async () => {
        mockSubmitIndexNow.mockResolvedValue({
            submitted: 3,
            ok: 1,
            failed: 1,
        });

        const counts = await runPrewarmBatch();

        expect(counts).toMatchObject({
            indexNowSubmitted: 3,
            indexNowOk: 1,
            indexNowFailed: 1,
        });
    });

    it('반영된 것이 없으면 제출도 sitemap 입력 로딩도 하지 않는다', async () => {
        // 모든 탭이 이미 fresh라 이번 배치에 처리할 심볼이 없다.
        mockFindGeneratedAtMap.mockResolvedValue(
            new Map([['AAPL:technical', new Date('2026-10-04T11:59:00.000Z')]])
        );

        const counts = await runPrewarmBatch();

        expect(counts.revalidated).toBe(0);
        expect(mockSubmitIndexNow).not.toHaveBeenCalled();
        expect(mockLoadPopular).not.toHaveBeenCalled();
        expect(counts).toMatchObject({
            indexNowSubmitted: 0,
            indexNowOk: 0,
            indexNowFailed: 0,
        });
    });

    it('반영되지 못한 심볼은 제출하지 않고 반영된 심볼만 한 번에 모아 제출한다', async () => {
        mockBuildPrewarmUniverse.mockReturnValue([
            { symbol: 'AAPL', tabs: ['technical'] },
            { symbol: 'MSFT', tabs: ['technical'] },
        ]);
        mockPrewarmTechnical.mockImplementation(async (symbol: string) => {
            if (symbol === 'MSFT') throw new Error('provider down');
            return { status: 'cached', result: {} };
        });

        const counts = await runPrewarmBatch();

        expect(counts.revalidated).toBe(1);
        const urls = submittedUrls();
        expect(urls).toEqual(AAPL_URLS);
        expect(urls.some(url => url.includes('/MSFT'))).toBe(false);
    });

    it('새로 구운 허브 URL은 심볼 URL과 같은 한 번의 호출로 제출한다', async () => {
        mockRunHubPrewarm.mockResolvedValue({
            ...HUBS_NOTHING_GENERATED,
            generated: 2,
            generatedUrls: [`${SITE_URL}/market/kr`, `${SITE_URL}/economy`],
        });

        await runPrewarmBatch();

        expect(submittedUrls()).toEqual([
            ...AAPL_URLS,
            `${SITE_URL}/market/kr`,
            `${SITE_URL}/economy`,
        ]);
    });

    it('심볼을 하나도 반영하지 않았어도 새로 구운 허브는 제출한다', async () => {
        mockBuildPrewarmUniverse.mockReturnValue([]);
        mockRunHubPrewarm.mockResolvedValue({
            ...HUBS_NOTHING_GENERATED,
            generated: 1,
            generatedUrls: [`${SITE_URL}/market`],
        });

        await runPrewarmBatch();

        expect(submittedUrls()).toEqual([`${SITE_URL}/market`]);
        expect(mockLoadPopular).not.toHaveBeenCalled();
    });

    it('허브 단계가 통째로 실패해도 심볼 제출은 계속된다', async () => {
        mockRunHubPrewarm.mockRejectedValue(new Error('hub phase down'));

        await runPrewarmBatch();

        expect(submittedUrls()).toEqual(AAPL_URLS);
    });

    it('제출은 심볼 처리가 끝난 뒤에 일어난다', async () => {
        await runPrewarmBatch();

        const seamOrder = mockPrewarmTechnical.mock.invocationCallOrder[0];
        const submitOrder = mockSubmitIndexNow.mock.invocationCallOrder[0];
        expect(seamOrder).toBeDefined();
        expect(submitOrder).toBeGreaterThan(seamOrder ?? Infinity);
    });

    it('제출이 reject해도 배치는 정상 종료하고 카운트는 그대로 돌려준다', async () => {
        mockSubmitIndexNow.mockRejectedValue(new Error('boom'));

        const counts = await runPrewarmBatch();

        expect(counts.harvested).toBe(1);
        expect(counts.revalidated).toBe(1);
        expect(counts.indexNowFailed).toBe(INDEXNOW_ENDPOINTS.length);
    });

    it('제출 모듈이 던지는 예기치 못한 오류(활성 판정 단계)도 배치를 깨뜨리지 않는다', async () => {
        mockIsIndexNowEnabled.mockImplementation(() => {
            throw new Error('env read blew up');
        });

        const counts = await runPrewarmBatch();

        expect(counts.harvested).toBe(1);
        expect(counts.indexNowFailed).toBe(INDEXNOW_ENDPOINTS.length);
        expect(console.error).toHaveBeenCalledWith(
            '[seo-prewarm] indexnow submission threw:',
            expect.any(Error)
        );
    });

    it('IndexNow가 꺼진 환경에서는 sitemap 입력도 읽지 않고 카운트가 0이다', async () => {
        mockIsIndexNowEnabled.mockReturnValue(false);

        const counts = await runPrewarmBatch();

        expect(counts.revalidated).toBe(1);
        expect(mockSubmitIndexNow).not.toHaveBeenCalled();
        expect(mockLoadPopular).not.toHaveBeenCalled();
        expect(counts).toMatchObject({
            indexNowSubmitted: 0,
            indexNowOk: 0,
            indexNowFailed: 0,
        });
    });
});
