/**
 * 프리웜 배치 → IndexNow 제출 배선 가드.
 *
 * 대기열(`indexNowQueue`)과 sitemap 입력 로더만 목으로 두고 `indexNowSubmission`은
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
    mockEnqueue,
    mockDrain,
    mockIsIndexNowEnabled,
    mockLoadPopular,
    mockLoadCrypto,
    mockLoadStatic,
    mockReadStaticLastmods,
    mockWriteStaticLastmods,
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
    mockEnqueue: vi.fn(),
    mockDrain: vi.fn(),
    mockIsIndexNowEnabled: vi.fn(),
    mockLoadPopular: vi.fn(),
    mockLoadCrypto: vi.fn(),
    mockLoadStatic: vi.fn(),
    mockReadStaticLastmods: vi.fn(),
    mockWriteStaticLastmods: vi.fn(),
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
    isIndexNowEnabled: mockIsIndexNowEnabled,
}));
vi.mock('@/shared/lib/indexNowQueue', () => ({
    enqueueIndexNow: mockEnqueue,
    drainIndexNow: mockDrain,
}));
vi.mock('../indexNowStaticPages', async importOriginal => ({
    ...(await importOriginal<typeof import('../indexNowStaticPages')>()),
    readStaticLastmods: mockReadStaticLastmods,
    writeStaticLastmods: mockWriteStaticLastmods,
}));
vi.mock('../lastClose', () => ({ fetchPageLastClose: vi.fn() }));

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
    changedUrls: [] as readonly string[],
};
// 차트(technical)만 harvest되는 배치 — 뉴스·공포탐욕 URL은 나가지 않는다.
const AAPL_URLS = [`${SITE_URL}/AAPL`];
const snapshotGeneratedAt = new Map<string, Date>([['AAPL:news', NOW]]);

/** 큐에 넣은 URL 목록 — 호출이 정확히 한 번이라는 사실까지 함께 고정한다. */
function queuedUrls(): readonly string[] {
    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    // 배치가 넘긴 `now`(고정된 시스템 시각)로 이 배치의 호출을 찾는다.
    const call = mockEnqueue.mock.calls.find(
        ([, at]) => at instanceof Date && at.getTime() === NOW.getTime()
    );
    expect(call).toBeDefined();
    return (call?.[0] as { url: string }[]).map(entry => entry.url);
}

/** 정적 페이지가 이미 시드된 상태 — 정적 페이지가 큐에 섞이지 않게 한다. */
function seededStaticLastmods(): Record<string, string> {
    return Object.fromEntries(
        buildStaticEntries(NOW)
            .filter(entry =>
                ['/about', '/methodology', '/privacy', '/terms', '/backtesting']
                    .map(path => `${SITE_URL}${path}`)
                    .includes(entry.url)
            )
            .map(entry => [entry.url, entry.lastModified!.toISOString()])
    );
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
        mockEnqueue.mockResolvedValue(0);
        mockWriteStaticLastmods.mockResolvedValue(undefined);
        mockReadStaticLastmods.mockResolvedValue(seededStaticLastmods());
        mockDrain.mockResolvedValue({
            submitted: 3,
            ok: 1,
            failed: 0,
            skipped: null,
            outcome: { kind: 'ok' },
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

    it('심볼 하나를 새로 구워 반영했으면 harvest된 탭의 sitemap URL만 큐에 넣고 drain한다', async () => {
        const counts = await runPrewarmBatch();

        expect(counts.revalidated).toBe(1);
        expect(queuedUrls()).toEqual(AAPL_URLS);
        expect(mockDrain).toHaveBeenCalledTimes(1);
    });

    it('제출 결과를 배치 카운트에 싣는다', async () => {
        mockDrain.mockResolvedValue({
            submitted: 3,
            ok: 1,
            failed: 1,
            skipped: null,
            outcome: { kind: 'transient', status: 503 },
        });

        const counts = await runPrewarmBatch();

        expect(counts).toMatchObject({
            indexNowSubmitted: 3,
            indexNowOk: 1,
            indexNowFailed: 1,
        });
    });

    it('반영된 것이 없어도 만기분 drain은 하지만 종목 sitemap 입력은 읽지 않는다', async () => {
        // 모든 탭이 이미 fresh라 이번 배치에 처리할 심볼이 없다.
        mockFindGeneratedAtMap.mockResolvedValue(
            new Map([['AAPL:technical', new Date('2026-10-04T11:59:00.000Z')]])
        );

        const counts = await runPrewarmBatch();

        expect(counts.revalidated).toBe(0);
        expect(mockDrain).toHaveBeenCalledTimes(1);
        expect(queuedUrls()).toEqual([]);
        expect(mockLoadPopular).not.toHaveBeenCalled();
        expect(counts).toMatchObject({
            indexNowSubmitted: 3,
            indexNowOk: 1,
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
        const urls = queuedUrls();
        expect(urls).toEqual(AAPL_URLS);
        expect(urls.some(url => url.includes('/MSFT'))).toBe(false);
    });

    it('새로 구운 허브 URL은 심볼 URL과 같은 한 번의 큐 쓰기로 넣는다', async () => {
        mockRunHubPrewarm.mockResolvedValue({
            ...HUBS_NOTHING_GENERATED,
            generated: 2,
            generatedUrls: [`${SITE_URL}/market/kr`, `${SITE_URL}/economy`],
        });

        await runPrewarmBatch();

        expect(queuedUrls()).toEqual([
            ...AAPL_URLS,
            `${SITE_URL}/market/kr`,
            `${SITE_URL}/economy`,
        ]);
    });

    it('심볼을 하나도 반영하지 않았어도 새로 구운 허브는 큐에 넣는다', async () => {
        mockBuildPrewarmUniverse.mockReturnValue([]);
        mockRunHubPrewarm.mockResolvedValue({
            ...HUBS_NOTHING_GENERATED,
            generated: 1,
            generatedUrls: [`${SITE_URL}/market`],
        });

        await runPrewarmBatch();

        expect(queuedUrls()).toEqual([`${SITE_URL}/market`]);
        expect(mockLoadPopular).not.toHaveBeenCalled();
    });

    it('본문이 바뀐 것으로만 확인된 허브 URL도 큐에 넣는다', async () => {
        mockBuildPrewarmUniverse.mockReturnValue([]);
        mockRunHubPrewarm.mockResolvedValue({
            ...HUBS_NOTHING_GENERATED,
            alreadyFresh: 1,
            changedUrls: [`${SITE_URL}/market/kr`],
        });

        await runPrewarmBatch();

        expect(queuedUrls()).toEqual([`${SITE_URL}/market/kr`]);
    });

    it('차트만 harvest되고 뉴스 탭은 backoff여도 차트는 revalidate·큐에 들어간다', async () => {
        mockBuildPrewarmUniverse.mockReturnValue([
            { symbol: 'AAPL', tabs: ['technical', 'news'] },
        ]);
        mockIsSkipped.mockImplementation(
            async (_symbol: string, tab: string) => tab === 'news'
        );

        const counts = await runPrewarmBatch();

        expect(counts.revalidated).toBe(1);
        expect(queuedUrls()).toEqual([`${SITE_URL}/AAPL`]);
    });

    it('허브 단계가 통째로 실패해도 심볼 제출은 계속된다', async () => {
        mockRunHubPrewarm.mockRejectedValue(new Error('hub phase down'));

        await runPrewarmBatch();

        expect(queuedUrls()).toEqual(AAPL_URLS);
    });

    it('제출은 심볼 처리가 끝난 뒤에 일어난다', async () => {
        await runPrewarmBatch();

        const seamOrder = mockPrewarmTechnical.mock.invocationCallOrder[0];
        const submitOrder = mockDrain.mock.invocationCallOrder[0];
        expect(seamOrder).toBeDefined();
        expect(submitOrder).toBeGreaterThan(seamOrder ?? Infinity);
    });

    it('제출이 reject해도 배치는 정상 종료하고 카운트는 그대로 돌려준다', async () => {
        mockDrain.mockRejectedValue(new Error('boom'));

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
        expect(mockEnqueue).not.toHaveBeenCalled();
        expect(mockDrain).not.toHaveBeenCalled();
        expect(mockLoadPopular).not.toHaveBeenCalled();
        expect(counts).toMatchObject({
            indexNowSubmitted: 0,
            indexNowOk: 0,
            indexNowFailed: 0,
        });
    });
});
