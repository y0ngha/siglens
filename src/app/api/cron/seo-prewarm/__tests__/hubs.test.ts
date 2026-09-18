/**
 * 허브 프리웜의 계약.
 *
 * 이 단계가 조용히 실패하는 방식이 둘 있다: ① 대상 하나가 던져 나머지가 통째로
 * 멈추는 것, ② 키가 어긋나 아무도 읽지 않는 자리에 쓰고 성공이라 보고하는 것.
 * 둘 다 화면·빌드에는 아무 흔적이 없어서 테스트로만 잡힌다.
 */
const mocks = vi.hoisted(() => ({
    runBriefing: vi.fn(),
    runMacroBriefing: vi.fn(),
    runMarketNewsDigest: vi.fn(),
    peekBriefingCache: vi.fn(),
    peekMacroBriefingCache: vi.fn(),
    peekMarketNewsDigestCache: vi.fn(),
    revalidateTag: vi.fn(),
    getCachedMarketSummary: vi.fn(),
    getEconomySnapshot: vi.fn(),
    getMarketNewsList: vi.fn(),
    selectAggregateNewsItems: vi.fn(),
    marketBriefingContextOf: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidateTag: mocks.revalidateTag }));
vi.mock('@y0ngha/siglens-core', async importOriginal => ({
    ...(await importOriginal<typeof import('@y0ngha/siglens-core')>()),
    runBriefing: mocks.runBriefing,
    runMacroBriefing: mocks.runMacroBriefing,
    runMarketNewsDigest: mocks.runMarketNewsDigest,
    peekBriefingCache: mocks.peekBriefingCache,
    peekMacroBriefingCache: mocks.peekMacroBriefingCache,
    peekMarketNewsDigestCache: mocks.peekMarketNewsDigestCache,
}));
vi.mock('@/entities/market-summary/api/marketSummaryCache', () => ({
    getCachedMarketSummary: mocks.getCachedMarketSummary,
}));
vi.mock('@/entities/market-summary/lib/marketBriefingContext', () => ({
    marketBriefingContextOf: mocks.marketBriefingContextOf,
}));
vi.mock('@/entities/economy/api/economySnapshotCache', () => ({
    getEconomySnapshot: mocks.getEconomySnapshot,
}));
vi.mock('@/entities/market-news/api', async importOriginal => ({
    ...(await importOriginal<typeof import('@/entities/market-news/api')>()),
    getMarketNewsList: mocks.getMarketNewsList,
}));
// 부분 목이다 — 전체 목이면 이 배럴에 export가 하나 생길 때마다 깨진다
// (`isEnrichedRow`가 실제로 그랬다). MISTAKES.md §18.5.
vi.mock('@/entities/news-article', async importOriginal => ({
    ...(await importOriginal<typeof import('@/entities/news-article')>()),
    selectAggregateNewsItems: mocks.selectAggregateNewsItems,
}));
vi.mock('@/shared/api/market/getMarketDataProvider', () => ({
    marketDataProviderFor: vi.fn(() => ({})),
}));

import { CATEGORY_CONFIG } from '@/entities/market-news';
import { DASHBOARD_SCOPES } from '@/shared/config/dashboardScope';
import {
    HUB_DEADLINE_MS,
    HUB_UNIT_TIMEOUT_MS,
    hubTargets,
    runHubPrewarm,
} from '@/app/api/cron/seo-prewarm/hubs';

const NEWS_ROW = { id: 'n1' };

function allSucceed(): void {
    mocks.getCachedMarketSummary.mockResolvedValue({ summary: true });
    mocks.marketBriefingContextOf.mockReturnValue({ ctx: true });
    mocks.getEconomySnapshot.mockResolvedValue({ snapshot: true });
    mocks.getMarketNewsList.mockResolvedValue([NEWS_ROW]);
    mocks.selectAggregateNewsItems.mockReturnValue([NEWS_ROW]);
    mocks.runBriefing.mockResolvedValue({ briefing: 'x' });
    mocks.runMacroBriefing.mockResolvedValue({ briefing: 'y' });
    mocks.runMarketNewsDigest.mockResolvedValue({ currentDriverKo: 'z' });
    mocks.peekBriefingCache.mockResolvedValue({ briefing: 'x' });
    mocks.peekMacroBriefingCache.mockResolvedValue({ briefing: 'y' });
    mocks.peekMarketNewsDigestCache.mockResolvedValue({
        currentDriverKo: 'z',
    });
}

describe('hubTargets', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        allSucceed();
    });

    /**
     * 대상 목록을 손으로 적지 않는다 — 카테고리나 시장이 하나 늘 때마다 그 숫자만
     * 고치게 되고, 정작 "새로 생긴 표면이 프리웜에서 빠졌다"는 사실은 못 잡는다.
     */
    it('실제 설정에서 파생된다 — 대시보드 스코프 + 거시 1 + 뉴스 카테고리 전부', () => {
        const labels = hubTargets().map(t => t.label);

        for (const scope of Object.values(DASHBOARD_SCOPES)) {
            expect(labels).toContain(`market-briefing:${scope.id}`);
        }
        expect(labels).toContain('macro-briefing');
        for (const category of Object.keys(CATEGORY_CONFIG)) {
            expect(labels).toContain(`news-digest:${category}`);
        }
        expect(labels).toHaveLength(
            Object.keys(DASHBOARD_SCOPES).length +
                1 +
                Object.keys(CATEGORY_CONFIG).length
        );
    });

    it('대상마다 무효화 태그가 있다 — 안 털면 페이지가 옛 null을 계속 렌더한다', () => {
        for (const target of hubTargets()) {
            expect(target.tag).toMatch(
                /^(market:briefing:|economy:briefing$|market-news:digest:)/
            );
        }
    });
});

describe('runHubPrewarm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        allSucceed();
    });

    it('전부 성공하면 대상 수만큼 생성하고 태그를 턴다', async () => {
        const result = await runHubPrewarm();

        expect(result.generated).toBe(hubTargets().length);
        expect(result.failed).toBe(0);
        expect(result.keyMismatch).toBe(0);
        expect(mocks.revalidateTag).toHaveBeenCalledTimes(hubTargets().length);
    });

    it('하나가 던져도 나머지는 계속 굽는다', async () => {
        mocks.runMacroBriefing.mockRejectedValue(new Error('provider down'));
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        const result = await runHubPrewarm();

        expect(result.failed).toBe(1);
        expect(result.generated).toBe(hubTargets().length - 1);
        errorSpy.mockRestore();
    });

    /**
     * 되읽기가 끝내 비면 키가 어긋났다는 신호다. 생성은 성공했으므로 예외도 없고
     * 화면도 멀쩡하다 — 이 카운터와 로그가 유일한 단서다.
     *
     * 단 **태그는 턴다.** 무효화는 멱등이고, core가 캐시 쓰기를 await하지 않으므로
     * 값이 실제로는 들어가 있을 수 있다. 안 털면 그 경우 페이지가 TTL 내내
     * 플레이스홀더로 남는다 — 이 기능이 고치려던 증상 그대로다.
     */
    it('되읽기가 끝내 비면 불일치로 세되 태그는 턴다', async () => {
        mocks.peekMacroBriefingCache.mockResolvedValue(null);
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        const result = await runHubPrewarm();

        expect(result.keyMismatch).toBe(1);
        expect(result.generated).toBe(hubTargets().length - 1);
        expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining('[hub-prewarm] key mismatch')
        );
        expect(mocks.revalidateTag).toHaveBeenCalledWith(
            'economy:briefing',
            'max'
        );
        errorSpy.mockRestore();
    });

    /**
     * core의 `run*`은 캐시 쓰기를 await하지 않는다. 생성 직후의 첫 읽기가 아직
     * 착지하지 않은 SET과 경합해 `null`을 줄 수 있어, 몇 번 더 읽어 그 창을 덮는다.
     * 재시도가 없으면 정상 동작이 "불일치"로 오보된다.
     */
    it('첫 되읽기가 비어도 뒤이어 값이 보이면 성공으로 센다', async () => {
        mocks.peekMacroBriefingCache
            .mockResolvedValueOnce(null)
            .mockResolvedValue({ briefing: 'y' });

        const result = await runHubPrewarm();

        expect(result.keyMismatch).toBe(0);
        expect(result.generated).toBe(hubTargets().length);
    });

    /**
     * 단계 마감은 대상 **사이**에서만 검사된다 — 한 건이 멎으면 그것만으로는 못 막고,
     * 그 정지가 심볼 배치 예산과 Redis 락 보유 시간을 그대로 먹는다. 심볼 프리웜이
     * `UNIT_TIMEOUT_MS`를 둔 이유와 같아서 여기도 개별 상한을 둔다.
     */
    it('한 대상이 멎으면 유닛 타임아웃으로 끊고 나머지를 계속 굽는다', async () => {
        vi.useFakeTimers();
        mocks.runMacroBriefing.mockImplementation(() => new Promise(() => {}));
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        const pending = runHubPrewarm();
        await vi.advanceTimersByTimeAsync(HUB_UNIT_TIMEOUT_MS + 1_000);
        const result = await pending;

        expect(result.failed).toBe(1);
        expect(result.generated).toBe(hubTargets().length - 1);
        expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining('[hub-prewarm] failed: macro-briefing'),
            expect.objectContaining({
                message: expect.stringContaining('unit timeout'),
            })
        );
        errorSpy.mockRestore();
        vi.useRealTimers();
    });

    it('마감을 넘기면 남은 대상을 건너뛴다 — 심볼 배치 예산을 지킨다', async () => {
        let t = 0;
        // 첫 두 번(시작 시각 + 첫 대상 판정)은 예산 안, 그 뒤로는 초과.
        const now = vi.fn(() => {
            t += 1;
            return t <= 2 ? 0 : HUB_DEADLINE_MS + 1;
        });

        const result = await runHubPrewarm(now);

        expect(result.skippedByDeadline).toBe(hubTargets().length - 1);
        expect(result.generated).toBe(1);
    });

    /**
     * 기사가 없는 카테고리는 다이제스트를 만들 수 없다. 그건 고장이 아니라 할 일이
     * 없는 것이라, 생성도 경보도 하지 않는다.
     */
    it('뉴스가 없는 카테고리는 생성 없이 통과시킨다', async () => {
        mocks.selectAggregateNewsItems.mockReturnValue([]);

        const result = await runHubPrewarm();

        expect(mocks.runMarketNewsDigest).not.toHaveBeenCalled();
        expect(result.failed).toBe(0);
        expect(result.keyMismatch).toBe(0);
    });

    /**
     * 캐시 키는 입력에서 파생된다. 액션이 쓰는 값과 하나라도 다르면 아무도 읽지 않는
     * 자리에 쓰게 되므로, 키 성분(`reasoning`·`modelId`·`locale`)을 고정한다.
     */
    it('다이제스트 생성이 액션과 같은 키 성분을 넘긴다', async () => {
        await runHubPrewarm();

        expect(mocks.runMarketNewsDigest).toHaveBeenCalledWith(
            expect.objectContaining({ reasoning: true, locale: 'ko' })
        );
    });

    /**
     * 프로바이더 폴백은 캐시 키 성분이 **아니지만**, 이 레포의 모든 프리웜·백필
     * 호출부가 켜 두는 값이다(core JSDoc도 "SEO prewarm"을 대상으로 명시). 지켜보는
     * 사람이 없어 수동 재시도가 불가능한 경로라, 빠지면 DeepSeek가 한 번 흔들릴 때
     * 그 카테고리 다이제스트만 조용히 비어 버린다.
     */
    it('다이제스트 생성에 프로바이더 폴백을 켠다', async () => {
        await runHubPrewarm();

        expect(mocks.runMarketNewsDigest).toHaveBeenCalledWith(
            expect.objectContaining({ providerFallback: true })
        );
    });
});
