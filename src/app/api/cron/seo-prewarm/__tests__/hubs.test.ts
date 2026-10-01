/**
 * 허브 프리웜의 계약.
 *
 * 이 단계가 조용히 실패하는 방식이 둘 있다: ① 대상 하나가 던져 나머지가 통째로
 * 멈추는 것, ② 키가 어긋나 아무도 읽지 않는 자리에 쓰고 성공이라 보고하는 것.
 * 둘 다 화면·빌드에는 아무 흔적이 없어서 테스트로만 잡힌다.
 */
const mocks = vi.hoisted(() => ({
    cooldownIsSet: vi.fn(),
    cooldownMark: vi.fn(),
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
    writeHubSsrSeed: vi.fn(),
    ingestMarketNewsCategory: vi.fn(),
    isCronIngestedRecently: vi.fn(),
    markCronIngested: vi.fn(),
    consumeSsrMiss: vi.fn(),
    shouldCacheEconomySnapshot: vi.fn(),
    ingestEconomicCalendar: vi.fn(),
    analyzeEconomicEvents: vi.fn(),
    translateUnresolvedCalendarIndicators: vi.fn(),
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
vi.mock(
    '@/entities/market-news/api/marketNewsRepository',
    async importOriginal => ({
        ...(await importOriginal<
            typeof import('@/entities/market-news/api/marketNewsRepository')
        >()),
        getMarketNewsList: mocks.getMarketNewsList,
        isCronIngestedRecently: mocks.isCronIngestedRecently,
        markCronIngested: mocks.markCronIngested,
    })
);
vi.mock('@/entities/market-news/api/ingestMarketNewsCategory', () => ({
    ingestMarketNewsCategory: mocks.ingestMarketNewsCategory,
}));
// 부분 목이다 — 전체 목이면 이 모듈에 export가 하나 생길 때마다 깨진다
// (`isEnrichedRow`가 실제로 그랬다). MISTAKES.md §18.5.
// 부분 목이다 — 전체 목이면 이 배럴에 export가 하나 생길 때마다 깨진다
// (`isEnrichedRow`가 실제로 그랬다). MISTAKES.md §18.5.
vi.mock(
    '@/entities/news-article/lib/newsAnalysisSelection',
    async importOriginal => ({
        ...(await importOriginal<
            typeof import('@/entities/news-article/lib/newsAnalysisSelection')
        >()),
        selectAggregateNewsItems: mocks.selectAggregateNewsItems,
    })
);
vi.mock('@/shared/cache/hubSsrSeed', () => ({
    writeHubSsrSeed: mocks.writeHubSsrSeed,
}));
vi.mock('@/shared/cache/ssrMissMarker', () => ({
    consumeSsrMiss: mocks.consumeSsrMiss,
}));
// 시장 브리핑 쿨다운 플래그(`hubs.ts` 모듈 로드 시 생성). 다른 모듈이 만드는 플래그도
// 이 목을 받지만, 이 파일은 그쪽 함수를 전부 따로 목으로 갈아 끼우므로 영향이 없다.
vi.mock('@/shared/cache/createRedisFlag', () => ({
    createRedisFlag: () => ({
        isSet: mocks.cooldownIsSet,
        mark: mocks.cooldownMark,
    }),
}));
vi.mock('@/entities/economy/lib/economyCompleteness', () => ({
    shouldCacheEconomySnapshot: mocks.shouldCacheEconomySnapshot,
}));
vi.mock('@/entities/economy/api/ingestEconomicCalendar', () => ({
    ingestEconomicCalendar: mocks.ingestEconomicCalendar,
}));
vi.mock('@/entities/economy/api/analyzeEconomicEvents', () => ({
    analyzeEconomicEvents: mocks.analyzeEconomicEvents,
}));
vi.mock('@/entities/economy/api/translateIndicators', () => ({
    translateUnresolvedCalendarIndicators:
        mocks.translateUnresolvedCalendarIndicators,
}));
// 부분 목 — 키 이름은 엔티티가 소유하므로 실제 구현을 그대로 쓴다(이름이 바뀌면
// 프리웜과 페이지가 같이 따라가야 하고, 그 일치를 여기서 검증한다).
vi.mock('@/shared/api/market/getMarketDataProvider', () => ({
    marketDataProviderFor: vi.fn(() => ({})),
}));

import { CATEGORY_CONFIG } from '@/entities/market-news/lib/categoryConfig';
import {
    MACRO_BRIEFING_CACHE_TAG,
    MACRO_BRIEFING_SEED_SURFACE,
} from '@/entities/economy/api/macroBriefingStaticCache';
import {
    marketBriefingCacheTag,
    marketBriefingSeedSurface,
} from '@/entities/market-summary/api/briefingStaticCache';
import { marketNewsDigestCacheTag } from '@/entities/market-news/api/marketNewsDigestStaticCache';
import { ECONOMY_SNAPSHOT_CACHE_TAG } from '@/entities/economy/api/economySnapshotStaticCache';
import {
    CALENDAR_COUNTRY,
    CALENDAR_COUNTRY_KR,
    economyCalendarCacheTag,
} from '@/entities/economy/lib/economyCalendarConstants';
import { DASHBOARD_SCOPES } from '@/shared/config/dashboardScope';
import {
    HUB_DEADLINE_MS,
    HUB_UNIT_TIMEOUT_MS,
    hubTargets,
    runHubPrewarm,
} from '@/app/api/cron/seo-prewarm/hubs';

const NEWS_ROW = { id: 'n1' };

/**
 * 캐시의 **실제 계약**을 흉내 낸다 — 생성 전에는 비어 있고, 생성 뒤에 값이 보인다.
 *
 * peek가 처음부터 값을 주게 두면 프리웜이 전부 `alreadyFresh`로 빠져, 생성 경로를
 * 검증한다고 믿는 테스트가 실은 아무것도 굽지 않는 상태가 된다.
 */
function fillsAfterRun(run: { mock: { calls: unknown[] } }, value: unknown) {
    // 대상마다 `peek(사전) → run → peek(되읽기)` 순서다. 시장 브리핑처럼 대상 둘이
    // 같은 `run` 목을 공유하므로 "run이 한 번이라도 불렸나"로는 두 번째 대상의
    // 사전 peek이 값을 보게 된다 — 이미 준 횟수와 비교해 대상별로 갈라 준다.
    let given = 0;
    return async () => {
        if (run.mock.calls.length > given) {
            given += 1;
            return value;
        }
        return null;
    };
}

/** 캘린더 세 단계가 모두 "바뀐 것 없음"을 돌려주게 한다 → 대상이 `alreadyFresh`. */
function calendarUnchanged(): void {
    mocks.ingestEconomicCalendar.mockResolvedValue({
        status: 'ok',
        changed: 0,
    });
    mocks.analyzeEconomicEvents.mockResolvedValue({
        status: 'ok',
        persisted: 0,
        pending: 0,
    });
    mocks.translateUnresolvedCalendarIndicators.mockResolvedValue(0);
}

function allSucceed(): void {
    mocks.cooldownIsSet.mockResolvedValue(false);
    mocks.cooldownMark.mockResolvedValue(undefined);
    mocks.getCachedMarketSummary.mockResolvedValue({ summary: true });
    mocks.marketBriefingContextOf.mockReturnValue({ ctx: true });
    mocks.getEconomySnapshot.mockResolvedValue({ snapshot: true });
    mocks.shouldCacheEconomySnapshot.mockReturnValue(true);
    mocks.consumeSsrMiss.mockResolvedValue(false);
    mocks.ingestEconomicCalendar.mockResolvedValue({
        status: 'ok',
        changed: 1,
    });
    mocks.analyzeEconomicEvents.mockResolvedValue({
        status: 'ok',
        persisted: 1,
        pending: 0,
    });
    mocks.translateUnresolvedCalendarIndicators.mockResolvedValue(1);
    mocks.getMarketNewsList.mockResolvedValue([NEWS_ROW]);
    mocks.selectAggregateNewsItems.mockReturnValue([NEWS_ROW]);
    mocks.isCronIngestedRecently.mockResolvedValue(false);
    mocks.markCronIngested.mockResolvedValue(undefined);
    mocks.ingestMarketNewsCategory.mockResolvedValue({
        status: 'ok',
        fetched: 1,
        changed: 1,
        analyzed: 1,
        pending: 0,
        enriched: 1,
    });
    mocks.runBriefing.mockResolvedValue({ briefing: 'x' });
    mocks.runMacroBriefing.mockResolvedValue({ briefing: 'y' });
    mocks.runMarketNewsDigest.mockResolvedValue({ currentDriverKo: 'z' });
    mocks.peekBriefingCache.mockImplementation(
        fillsAfterRun(mocks.runBriefing, { briefing: 'x' })
    );
    mocks.peekMacroBriefingCache.mockImplementation(
        fillsAfterRun(mocks.runMacroBriefing, { briefing: 'y' })
    );
    mocks.peekMarketNewsDigestCache.mockImplementation(
        fillsAfterRun(mocks.runMarketNewsDigest, { currentDriverKo: 'z' })
    );
}

/**
 * 브리핑 프리웜이 실제로 도는 대상. `DASHBOARD_SCOPES` 전체가 아니다 —
 * 화면 없는 scope(`crypto`)는 생성 비용만 내고 읽는 쪽이 없어 제외된다.
 */
const PAGE_SCOPES = Object.values(DASHBOARD_SCOPES).filter(s => s.hasHubPage);

const CALENDAR_COUNTRIES = [CALENDAR_COUNTRY, CALENDAR_COUNTRY_KR];

describe('hubTargets', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        allSucceed();
    });

    /**
     * 대상 목록을 손으로 적지 않는다 — 카테고리나 시장이 하나 늘 때마다 그 숫자만
     * 고치게 되고, 정작 "새로 생긴 표면이 프리웜에서 빠졌다"는 사실은 못 잡는다.
     */
    it('실제 설정에서 파생된다 — 허브 페이지가 있는 스코프 + 거시 1 + 경제 캘린더(국가별) + 뉴스 카테고리 전부', () => {
        const labels = hubTargets().map(t => t.label);
        for (const scope of PAGE_SCOPES) {
            expect(labels).toContain(`market-briefing:${scope.id}`);
        }
        expect(labels).toContain('macro-briefing');
        for (const country of CALENDAR_COUNTRIES) {
            expect(labels).toContain(`economy-calendar:${country}`);
        }
        for (const category of Object.keys(CATEGORY_CONFIG)) {
            expect(labels).toContain(`news-digest:${category}`);
        }
        expect(labels).toHaveLength(
            PAGE_SCOPES.length +
                1 +
                CALENDAR_COUNTRIES.length +
                Object.keys(CATEGORY_CONFIG).length
        );
    });

    /**
     * 이 순회는 브리핑을 **생성**한다(LLM 호출). 화면 없는 scope가 끼면 아무도 읽지
     * 않는 결과를 매일 밤 굽는데, 비용 말고는 아무 신호도 나지 않는다 —
     * `crypto`를 `DASHBOARD_SCOPES`에 넣었을 때 실제로 그랬다.
     */
    it('허브 페이지가 없는 스코프는 브리핑 프리웜에 들어가지 않는다', () => {
        const pageless = Object.values(DASHBOARD_SCOPES).filter(
            s => !s.hasHubPage
        );
        expect(pageless.length).toBeGreaterThan(0);
        const labels = hubTargets().map(t => t.label);
        for (const scope of pageless) {
            expect(labels).not.toContain(`market-briefing:${scope.id}`);
        }
    });

    it('대상마다 무효화 태그가 있다 — 안 털면 페이지가 옛 null을 계속 렌더한다', () => {
        for (const target of hubTargets()) {
            expect(target.tag).toMatch(
                /^(market:briefing:|economy:briefing$|economy:calendar|market-news:digest:)/
            );
        }
    });

    /**
     * 프리웜이 터는 태그는 `peek*Static`이 **다는** 태그와 글자 하나까지 같아야 한다.
     * 프리웜이 태그를 따로 철자하면, 한쪽만 바뀌는 순간 무효화가 빗나가 ISR이 옛
     * `null`(플레이스홀더)을 TTL 내내 서빙한다. 그래서 엔티티 소유 빌더와 대조한다.
     */
    it('무효화 태그는 엔티티가 캐시에 다는 태그와 같다', () => {
        const expected = new Set<string>([
            ...Object.values(DASHBOARD_SCOPES)
                .filter(scope => scope.hasHubPage)
                .map(scope => marketBriefingCacheTag(scope)),
            MACRO_BRIEFING_CACHE_TAG,
            ...CALENDAR_COUNTRIES.map(country =>
                economyCalendarCacheTag(country)
            ),
            ...(
                Object.keys(CATEGORY_CONFIG) as Array<
                    keyof typeof CATEGORY_CONFIG
                >
            ).map(category => marketNewsDigestCacheTag(category)),
        ]);
        expect(new Set(hubTargets().map(t => t.tag))).toEqual(expected);
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
        // 경제 캘린더는 스스로 턴다(`selfInvalidating`) — 러너는 나머지만 턴다.
        expect(mocks.revalidateTag).toHaveBeenCalledTimes(
            hubTargets().filter(t => t.selfInvalidating !== true).length
        );
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
            // ① 사전 peek(캐시 미스) ② 첫 되읽기(아직 안 착지한 SET과 경합)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null)
            .mockResolvedValue({ briefing: 'y' });
        // 실제 타이머로 두면 재시도 간격만큼 진짜로 대기한다. 가짜 타이머로 넘긴다.
        vi.useFakeTimers();

        const pending = runHubPrewarm();
        // 재시도 간격 전부를 덮는 여유값(간격 상수는 모듈 내부라 넉넉히 준다).
        await vi.advanceTimersByTimeAsync(5_000);
        const result = await pending;

        expect(result.keyMismatch).toBe(0);
        expect(result.generated).toBe(hubTargets().length);
        vi.useRealTimers();
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
    it('뉴스가 없는 카테고리는 생성이 아니라 noData로 세고 태그도 안 턴다', async () => {
        mocks.selectAggregateNewsItems.mockReturnValue([]);

        const result = await runHubPrewarm();

        expect(mocks.runMarketNewsDigest).not.toHaveBeenCalled();
        expect(result.failed).toBe(0);
        expect(result.keyMismatch).toBe(0);
        // "할 일 없음"을 generated에 합치면, getMarketNewsList가 버그로 빈 배열을
        // 주는 진짜 장애도 로그에 100% 성공으로 찍힌다.
        expect(result.noData).toBe(Object.keys(CATEGORY_CONFIG).length);
        expect(result.generated).toBe(
            hubTargets().length - Object.keys(CATEGORY_CONFIG).length
        );
        for (const category of Object.keys(CATEGORY_CONFIG)) {
            expect(mocks.revalidateTag).not.toHaveBeenCalledWith(
                `market-news:digest:${category}`,
                'max'
            );
        }
    });

    /**
     * 이 크론은 하룻밤 126번 돈다. core 캐시가 살아 있으면 `run*`은 즉시 캐시값을
     * 돌려주므로, 그때도 태그를 털면 데이터가 하나도 안 변했는데 무효화만 9 × 126회
     * 나간다 — 이 레포가 이미 겪은 ISR 과금 패턴이다(MISTAKES.md "ISR & Caching #1").
     */
    it('이미 캐시에 있으면 생성도 무효화도 하지 않는다', async () => {
        mocks.peekBriefingCache.mockResolvedValue({ briefing: 'x' });
        mocks.peekMacroBriefingCache.mockResolvedValue({ briefing: 'y' });
        mocks.peekMarketNewsDigestCache.mockResolvedValue({
            currentDriverKo: 'z',
        });
        calendarUnchanged();

        const result = await runHubPrewarm();

        expect(result.alreadyFresh).toBe(hubTargets().length);
        expect(result.generated).toBe(0);
        expect(mocks.runBriefing).not.toHaveBeenCalled();
        expect(mocks.runMacroBriefing).not.toHaveBeenCalled();
        expect(mocks.runMarketNewsDigest).not.toHaveBeenCalled();
        expect(mocks.revalidateTag).not.toHaveBeenCalled();
    });

    /**
     * 캐시 키는 입력에서 파생된다. 액션이 쓰는 값과 하나라도 다르면 아무도 읽지 않는
     * 자리에 쓰게 되므로, 키 성분(`reasoning`·`modelId`·`locale`)을 고정한다.
     */
    it('다이제스트 생성이 액션과 같은 키 성분을 넘긴다', async () => {
        await runHubPrewarm();

        expect(mocks.runMarketNewsDigest).toHaveBeenCalledWith(
            expect.objectContaining({ reasoning: false, locale: 'ko' })
        );
    });

    /**
     * core 캐시 키가 시세에서 파생되는 탓에, 프리웜이 쓴 값을 페이지가 나중에 같은 키로
     * 읽지 못한다(2026-09-18 실측: 15분 뒤 miss). 그래서 확인한 본문을 표면 단위 고정
     * 키에 한 벌 더 둔다 — 이게 없으면 /market·/economy는 계속 빈 채로 색인된다.
     */
    it('브리핑은 새로 구웠을 때 SSR seed를 쓴다', async () => {
        await runHubPrewarm();

        for (const scope of PAGE_SCOPES) {
            expect(mocks.writeHubSsrSeed).toHaveBeenCalledWith(
                marketBriefingSeedSurface(scope),
                { briefing: 'x' }
            );
        }
        expect(mocks.writeHubSsrSeed).toHaveBeenCalledWith(
            MACRO_BRIEFING_SEED_SURFACE,
            { briefing: 'y' }
        );
    });

    it('이미 캐시에 있어도 seed는 갱신한다 — 값이 이미 손에 있다', async () => {
        mocks.peekBriefingCache.mockResolvedValue({ briefing: 'x' });
        mocks.peekMacroBriefingCache.mockResolvedValue({ briefing: 'y' });
        mocks.peekMarketNewsDigestCache.mockResolvedValue({
            currentDriverKo: 'z',
        });
        calendarUnchanged();

        const result = await runHubPrewarm();

        expect(result.alreadyFresh).toBe(hubTargets().length);
        // 시장 브리핑도 같은 분기를 탄다 — macro만 단언하면 그쪽 회귀를 놓친다.
        for (const scope of PAGE_SCOPES) {
            expect(mocks.writeHubSsrSeed).toHaveBeenCalledWith(
                marketBriefingSeedSurface(scope),
                { briefing: 'x' }
            );
        }
        expect(mocks.writeHubSsrSeed).toHaveBeenCalledWith(
            MACRO_BRIEFING_SEED_SURFACE,
            { briefing: 'y' }
        );
    });

    /**
     * 다이제스트는 입력이 DB 행 목록이라 정적 peek이 같은 입력을 다시 만들어 키가 맞는다.
     * seed까지 두면 색인된 본문의 출처가 둘이 되어 진단이 어려워진다.
     */
    it('다이제스트에는 seed를 쓰지 않는다', async () => {
        await runHubPrewarm();

        const surfaces = mocks.writeHubSsrSeed.mock.calls.map(c => c[0]);
        expect(surfaces.some(x => String(x).includes('news-digest'))).toBe(
            false
        );
        expect(surfaces).toHaveLength(PAGE_SCOPES.length + 1);
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

/**
 * 다이제스트 전에 그 카테고리 기사를 적재한다(ingest-before-read).
 *
 * 예전엔 이 단계가 DB만 읽어, 방문이 없는 카테고리(`forex`·`articles`)는 몇 주씩
 * 비었고 "다이제스트는 있는데 목록은 비어 있는" 화면도 나왔다.
 */
describe('runHubPrewarm — 뉴스 카테고리 적재', () => {
    const categories = Object.keys(CATEGORY_CONFIG);

    beforeEach(() => {
        vi.clearAllMocks();
        allSucceed();
    });

    it('카테고리마다 다이제스트를 읽기 전에 상한을 걸어 적재한다', async () => {
        const order: string[] = [];
        mocks.ingestMarketNewsCategory.mockImplementation(async () => {
            order.push('ingest');
            return {
                status: 'ok',
                fetched: 1,
                changed: 1,
                analyzed: 1,
                pending: 0,
                enriched: 1,
            };
        });
        mocks.getMarketNewsList.mockImplementation(async () => {
            order.push('read');
            return [NEWS_ROW];
        });

        await runHubPrewarm();

        expect(mocks.ingestMarketNewsCategory).toHaveBeenCalledTimes(
            categories.length
        );
        for (const category of categories) {
            expect(mocks.ingestMarketNewsCategory).toHaveBeenCalledWith(
                category,
                expect.objectContaining({ analyzeLimit: 8 })
            );
        }
        // 카테고리마다 ingest → read 순서다.
        expect(order).toEqual(categories.flatMap(() => ['ingest', 'read']));
    });

    it('적재가 끝나고 백로그가 없으면(ok, pending 0) 3시간 간격 플래그를 세운다', async () => {
        await runHubPrewarm();

        expect(mocks.markCronIngested).toHaveBeenCalledTimes(categories.length);
        expect(mocks.markCronIngested).toHaveBeenCalledWith(
            CATEGORY_CONFIG.forex.sentinel
        );
    });

    it('보강 백로그가 남고 다이제스트에 쓸 만큼 보강되지도 않았으면 플래그를 세우지 않는다', async () => {
        mocks.ingestMarketNewsCategory.mockResolvedValue({
            status: 'ok',
            fetched: 50,
            changed: 50,
            analyzed: 8,
            pending: 42,
            enriched: 8,
        });

        await runHubPrewarm();

        expect(mocks.markCronIngested).not.toHaveBeenCalled();
    });

    /**
     * 2026-10-01 운영 실측: `stock`·`crypto`는 10분마다 새 기사가 10~50건 들어와 `pending`이
     * 0이 되는 순간이 없었다. `pending === 0`만 조건이면 3시간 간격이 영원히 안 걸려
     * 10분마다 재적재·다이제스트 재생성이 돈다.
     */
    it('백로그가 남아도 다이제스트에 쓸 만큼(25건) 보강됐으면 플래그를 세운다 — 빠른 피드', async () => {
        mocks.ingestMarketNewsCategory.mockResolvedValue({
            status: 'ok',
            fetched: 50,
            changed: 40,
            analyzed: 8,
            pending: 34,
            enriched: 25,
        });

        await runHubPrewarm();

        expect(mocks.markCronIngested).toHaveBeenCalledTimes(categories.length);
    });

    it('보강 수가 기준에 1건 모자라면(24건) 아직 세우지 않는다', async () => {
        mocks.ingestMarketNewsCategory.mockResolvedValue({
            status: 'ok',
            fetched: 50,
            changed: 40,
            analyzed: 8,
            pending: 10,
            enriched: 24,
        });

        await runHubPrewarm();

        expect(mocks.markCronIngested).not.toHaveBeenCalled();
    });

    it('간격 안에 이미 적재했으면 적재를 건너뛰고 다이제스트만 굽는다', async () => {
        mocks.isCronIngestedRecently.mockResolvedValue(true);

        const result = await runHubPrewarm();

        expect(mocks.ingestMarketNewsCategory).not.toHaveBeenCalled();
        expect(mocks.runMarketNewsDigest).toHaveBeenCalledTimes(
            categories.length
        );
        expect(result.failed).toBe(0);
    });

    it.each(['fetch-failed', 'write-failed', 'recently-fetched'] as const)(
        '%s면 간격 플래그를 세우지 않는다 — 실패 하나가 3시간 공백이 되지 않게',
        async status => {
            mocks.ingestMarketNewsCategory.mockResolvedValue({ status });

            await runHubPrewarm();

            expect(mocks.markCronIngested).not.toHaveBeenCalled();
        }
    );

    it('적재가 던져도 다이제스트는 DB 기사로 계속 굽는다(fail-open)', async () => {
        mocks.ingestMarketNewsCategory.mockRejectedValue(new Error('db down'));
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);

        const result = await runHubPrewarm();

        expect(mocks.runMarketNewsDigest).toHaveBeenCalledTimes(
            categories.length
        );
        expect(mocks.markCronIngested).not.toHaveBeenCalled();
        expect(result.failed).toBe(0);
        errorSpy.mockRestore();
    });
});

/**
 * 경제 캘린더(적재 → 분석 → 지표명 번역)는 예전에 방문자 브라우저만 돌렸다.
 * 크론이 대신 굽되, 각 단계는 앞 단계 실패와 무관하게 진행해야 한다(fail-open).
 */
describe('runHubPrewarm — 경제 캘린더', () => {
    const calendarLabels = CALENDAR_COUNTRIES.map(c => `economy-calendar:${c}`);

    beforeEach(() => {
        vi.clearAllMocks();
        allSucceed();
    });

    it('거시 브리핑 뒤, 뉴스 다이제스트 앞에 국가별로 놓인다', () => {
        const labels = hubTargets().map(t => t.label);
        const macroIdx = labels.indexOf('macro-briefing');

        expect(labels.slice(macroIdx + 1, macroIdx + 3)).toEqual(
            calendarLabels
        );
        expect(labels[macroIdx + 3]).toMatch(/^news-digest:/);
    });

    it('국가별 태그는 엔티티 빌더와 같다', () => {
        const tags = hubTargets()
            .filter(t => t.label.startsWith('economy-calendar:'))
            .map(t => t.tag);

        expect(tags).toEqual(
            CALENDAR_COUNTRIES.map(c => economyCalendarCacheTag(c))
        );
    });

    it('적재 → 분석(상한 4) → 번역(상한 1) 순서로 국가마다 호출한다 — 유닛 45초 예산', async () => {
        const order: string[] = [];
        mocks.ingestEconomicCalendar.mockImplementation(async (c: string) => {
            order.push(`ingest:${c}`);
            return { status: 'ok', changed: 0 };
        });
        mocks.analyzeEconomicEvents.mockImplementation(async (c: string) => {
            order.push(`analyze:${c}`);
            return { status: 'ok', persisted: 0, pending: 0 };
        });
        mocks.translateUnresolvedCalendarIndicators.mockImplementation(
            async (c: string) => {
                order.push(`translate:${c}`);
                return 0;
            }
        );

        await runHubPrewarm();

        expect(order).toEqual(
            CALENDAR_COUNTRIES.flatMap(c => [
                `ingest:${c}`,
                `analyze:${c}`,
                `translate:${c}`,
            ])
        );
        for (const country of CALENDAR_COUNTRIES) {
            expect(mocks.ingestEconomicCalendar).toHaveBeenCalledWith(
                country,
                `hub-prewarm:economy-calendar:${country}`
            );
            expect(mocks.analyzeEconomicEvents).toHaveBeenCalledWith(country, {
                limit: 4,
                logLabel: `hub-prewarm:economy-calendar:${country}`,
            });
            expect(
                mocks.translateUnresolvedCalendarIndicators
            ).toHaveBeenCalledWith(country, {
                limit: 1,
                logLabel: `hub-prewarm:economy-calendar:${country}`,
            });
        }
    });

    it('아무것도 안 바뀌면 alreadyFresh이고 태그를 안 턴다', async () => {
        mocks.ingestEconomicCalendar.mockResolvedValue({
            status: 'ok',
            changed: 0,
        });
        mocks.analyzeEconomicEvents.mockResolvedValue({
            status: 'ok',
            persisted: 0,
            pending: 0,
        });
        mocks.translateUnresolvedCalendarIndicators.mockResolvedValue(0);
        const calendarTags = CALENDAR_COUNTRIES.map(c =>
            economyCalendarCacheTag(c)
        );

        const result = await runHubPrewarm();

        expect(result.alreadyFresh).toBe(CALENDAR_COUNTRIES.length);
        for (const tag of calendarTags) {
            expect(mocks.revalidateTag).not.toHaveBeenCalledWith(tag, 'max');
        }
    });

    it.each([
        [
            'ingest.changed > 0',
            { status: 'ok', changed: 2 },
            { status: 'ok', persisted: 0, pending: 0 },
            0,
        ],
        [
            'analyzed.persisted > 0',
            { status: 'recently-fetched' },
            { status: 'ok', persisted: 1, pending: 0 },
            0,
        ],
        [
            'translated > 0',
            { status: 'fetch-failed' },
            { status: 'recently-run' },
            2,
        ],
    ])(
        '%s면 generated로 세되 러너는 태그를 다시 털지 않는다(대상이 스스로 턴다)',
        async (_n, ingest, analyze, tr) => {
            mocks.ingestEconomicCalendar.mockResolvedValue(ingest);
            mocks.analyzeEconomicEvents.mockResolvedValue(analyze);
            mocks.translateUnresolvedCalendarIndicators.mockResolvedValue(tr);

            const result = await runHubPrewarm();

            expect(result.generated).toBe(hubTargets().length);
            for (const country of CALENDAR_COUNTRIES) {
                const tag = economyCalendarCacheTag(country);
                expect(mocks.revalidateTag).not.toHaveBeenCalledWith(
                    tag,
                    'max'
                );
                // 이 태그엔 SSR miss 표시가 없다 — getdel도 하지 않는다.
                expect(mocks.consumeSsrMiss).not.toHaveBeenCalledWith(tag);
            }
        }
    );

    it('적재가 던져도 분석·번역은 계속 돈다(fail-open)', async () => {
        mocks.ingestEconomicCalendar.mockRejectedValue(new Error('fmp down'));
        mocks.analyzeEconomicEvents.mockResolvedValue({
            status: 'ok',
            persisted: 0,
            pending: 0,
        });
        mocks.translateUnresolvedCalendarIndicators.mockResolvedValue(0);
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);

        const result = await runHubPrewarm();

        expect(mocks.analyzeEconomicEvents).toHaveBeenCalledTimes(
            CALENDAR_COUNTRIES.length
        );
        expect(
            mocks.translateUnresolvedCalendarIndicators
        ).toHaveBeenCalledTimes(CALENDAR_COUNTRIES.length);
        expect(result.failed).toBe(0);
        expect(result.alreadyFresh).toBe(CALENDAR_COUNTRIES.length);
        errorSpy.mockRestore();
    });

    it('분석·번역이 던져도 대상은 실패로 세지 않는다', async () => {
        mocks.analyzeEconomicEvents.mockRejectedValue(new Error('llm down'));
        mocks.translateUnresolvedCalendarIndicators.mockRejectedValue(
            new Error('llm down')
        );
        mocks.ingestEconomicCalendar.mockResolvedValue({
            status: 'ok',
            changed: 0,
        });
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);

        const result = await runHubPrewarm();

        expect(result.failed).toBe(0);
        expect(result.alreadyFresh).toBe(CALENDAR_COUNTRIES.length);
        errorSpy.mockRestore();
    });
});

/**
 * SSR이 빈 값으로 렌더됐다는 표시(`markSsrMiss`)를 크론이 소비한다. 표시가 있을
 * 때만 한 번 털어야 한다 — 무조건 털면 ISR 쓰기가 tick마다 나간다.
 */
describe('runHubPrewarm — SSR miss 표시', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        allSucceed();
    });

    function alreadyFreshAll(): void {
        mocks.peekBriefingCache.mockResolvedValue({ briefing: 'x' });
        mocks.peekMacroBriefingCache.mockResolvedValue({ briefing: 'y' });
        mocks.peekMarketNewsDigestCache.mockResolvedValue({
            currentDriverKo: 'z',
        });
        mocks.ingestEconomicCalendar.mockResolvedValue({
            status: 'ok',
            changed: 0,
        });
        mocks.analyzeEconomicEvents.mockResolvedValue({
            status: 'ok',
            persisted: 0,
            pending: 0,
        });
        mocks.translateUnresolvedCalendarIndicators.mockResolvedValue(0);
    }

    it('alreadyFresh + 표시 있음이면 그 태그를 턴다', async () => {
        alreadyFreshAll();
        mocks.consumeSsrMiss.mockImplementation(
            async (tag: string) => tag === MACRO_BRIEFING_CACHE_TAG
        );

        await runHubPrewarm();

        expect(mocks.revalidateTag).toHaveBeenCalledTimes(1);
        expect(mocks.revalidateTag).toHaveBeenCalledWith(
            MACRO_BRIEFING_CACHE_TAG,
            'max'
        );
    });

    it('alreadyFresh + 표시 없음이면 털지 않는다', async () => {
        alreadyFreshAll();

        await runHubPrewarm();

        expect(mocks.consumeSsrMiss).toHaveBeenCalledWith(
            MACRO_BRIEFING_CACHE_TAG
        );
        expect(mocks.revalidateTag).not.toHaveBeenCalled();
    });

    it('generated면 털고 나서 표시를 소비해 다음 tick의 중복 무효화를 막는다', async () => {
        await runHubPrewarm();

        for (const target of hubTargets().filter(
            t => t.selfInvalidating !== true
        )) {
            expect(mocks.consumeSsrMiss).toHaveBeenCalledWith(target.tag);
        }
    });

    it('거시 대상은 스냅샷이 완전하고 표시가 있을 때만 economy:snapshot을 턴다', async () => {
        alreadyFreshAll();
        mocks.consumeSsrMiss.mockImplementation(
            async (tag: string) => tag === ECONOMY_SNAPSHOT_CACHE_TAG
        );

        await runHubPrewarm();

        expect(mocks.revalidateTag).toHaveBeenCalledWith(
            ECONOMY_SNAPSHOT_CACHE_TAG,
            'max'
        );
    });

    it('스냅샷이 미달이면 표시를 소비하지도 털지도 않는다', async () => {
        alreadyFreshAll();
        mocks.shouldCacheEconomySnapshot.mockReturnValue(false);
        mocks.consumeSsrMiss.mockResolvedValue(true);

        await runHubPrewarm();

        expect(mocks.consumeSsrMiss).not.toHaveBeenCalledWith(
            ECONOMY_SNAPSHOT_CACHE_TAG
        );
        expect(mocks.revalidateTag).not.toHaveBeenCalledWith(
            ECONOMY_SNAPSHOT_CACHE_TAG,
            'max'
        );
    });

    it('스냅샷이 완전해도 표시가 없으면 economy:snapshot을 털지 않는다', async () => {
        alreadyFreshAll();

        await runHubPrewarm();

        expect(mocks.consumeSsrMiss).toHaveBeenCalledWith(
            ECONOMY_SNAPSHOT_CACHE_TAG
        );
        expect(mocks.revalidateTag).not.toHaveBeenCalledWith(
            ECONOMY_SNAPSHOT_CACHE_TAG,
            'max'
        );
    });
});

/**
 * 시장 브리핑 쿨다운 — 크론 생성은 시장별 시간당 한 번.
 *
 * 브리핑 캐시 키가 시세에서 파생돼 장중엔 tick마다 갈리고, 예전엔 5분마다 새로 구웠다.
 */
describe('runHubPrewarm — 시장 브리핑 쿨다운', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        allSucceed();
    });

    it('새로 구우면 시장별로 쿨다운을 세운다', async () => {
        await runHubPrewarm();

        expect(mocks.runBriefing).toHaveBeenCalledTimes(PAGE_SCOPES.length);
        for (const scope of PAGE_SCOPES) {
            expect(mocks.cooldownMark).toHaveBeenCalledWith(scope.id);
        }
    });

    it('쿨다운 중이면 굽지 않고 cooldown으로 센다 — 표시도 태그도 건드리지 않는다', async () => {
        mocks.cooldownIsSet.mockResolvedValue(true);

        mocks.consumeSsrMiss.mockResolvedValue(true);

        const result = await runHubPrewarm();

        expect(result.skippedByCooldown).toBe(PAGE_SCOPES.length);
        expect(mocks.runBriefing).not.toHaveBeenCalled();
        expect(mocks.cooldownMark).not.toHaveBeenCalled();
        // 값이 있는지 모르므로 SSR miss 표시를 소비하거나 태그를 털지 않는다 —
        // 털면 페이지가 다시 null로 렌더되며 tick당 쓰기 루프가 된다.
        for (const scope of PAGE_SCOPES) {
            const tag = marketBriefingCacheTag(scope);
            expect(mocks.consumeSsrMiss).not.toHaveBeenCalledWith(tag);
            expect(mocks.revalidateTag).not.toHaveBeenCalledWith(tag, 'max');
        }
        // 거시 브리핑·다이제스트는 쿨다운과 무관하게 그대로 굽는다.
        expect(mocks.runMacroBriefing).toHaveBeenCalledTimes(1);
    });

    it('캐시 HIT이면 쿨다운을 보지도 세우지도 않는다 — seed만 갱신한다', async () => {
        mocks.peekBriefingCache.mockResolvedValue({ briefing: 'x' });

        await runHubPrewarm();

        expect(mocks.runBriefing).not.toHaveBeenCalled();
        expect(mocks.cooldownMark).not.toHaveBeenCalled();
    });

    it('되읽기에 실패해도(keyMismatch) 쿨다운은 세운다 — LLM 비용은 이미 나갔다', async () => {
        mocks.peekBriefingCache.mockResolvedValue(null);
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);

        await runHubPrewarm();

        expect(mocks.cooldownMark).toHaveBeenCalledTimes(PAGE_SCOPES.length);
        errorSpy.mockRestore();
    });
});

describe('runHubPrewarm — 경제 캘린더 실패 집계', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        allSucceed();
    });

    it('적재와 분석이 둘 다 실패하면 failed로 센다 — 장애가 "캐시 신선"으로 묻히지 않게', async () => {
        mocks.ingestEconomicCalendar.mockResolvedValue({
            status: 'fetch-failed',
        });
        mocks.analyzeEconomicEvents.mockRejectedValue(new Error('db down'));
        mocks.translateUnresolvedCalendarIndicators.mockResolvedValue(0);
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);

        const result = await runHubPrewarm();

        expect(result.failed).toBe(CALENDAR_COUNTRIES.length);
        errorSpy.mockRestore();
    });

    it('적재만 실패하고 분석이 정상이면 fail-open으로 계속 간다', async () => {
        mocks.ingestEconomicCalendar.mockResolvedValue({
            status: 'write-failed',
        });
        mocks.analyzeEconomicEvents.mockResolvedValue({
            status: 'ok',
            persisted: 0,
            pending: 0,
        });
        mocks.translateUnresolvedCalendarIndicators.mockResolvedValue(0);

        const result = await runHubPrewarm();

        expect(result.failed).toBe(0);
    });
});
