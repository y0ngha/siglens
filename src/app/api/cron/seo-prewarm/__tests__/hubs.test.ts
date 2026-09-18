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
    writeHubSsrSeed: vi.fn(),
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
vi.mock('@/shared/cache/hubSsrSeed', () => ({
    writeHubSsrSeed: mocks.writeHubSsrSeed,
}));
// 부분 목 — 키 이름은 엔티티가 소유하므로 실제 구현을 그대로 쓴다(이름이 바뀌면
// 프리웜과 페이지가 같이 따라가야 하고, 그 일치를 여기서 검증한다).
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

function allSucceed(): void {
    mocks.getCachedMarketSummary.mockResolvedValue({ summary: true });
    mocks.marketBriefingContextOf.mockReturnValue({ ctx: true });
    mocks.getEconomySnapshot.mockResolvedValue({ snapshot: true });
    mocks.getMarketNewsList.mockResolvedValue([NEWS_ROW]);
    mocks.selectAggregateNewsItems.mockReturnValue([NEWS_ROW]);
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
            expect.objectContaining({ reasoning: true, locale: 'ko' })
        );
    });

    /**
     * core 캐시 키가 시세에서 파생되는 탓에, 프리웜이 쓴 값을 페이지가 나중에 같은 키로
     * 읽지 못한다(2026-09-18 실측: 15분 뒤 miss). 그래서 확인한 본문을 표면 단위 고정
     * 키에 한 벌 더 둔다 — 이게 없으면 /market·/economy는 계속 빈 채로 색인된다.
     */
    it('브리핑은 새로 구웠을 때 SSR seed를 쓴다', async () => {
        await runHubPrewarm();

        expect(mocks.writeHubSsrSeed).toHaveBeenCalledWith(
            'market-briefing:us',
            { briefing: 'x' }
        );
        expect(mocks.writeHubSsrSeed).toHaveBeenCalledWith('macro-briefing', {
            briefing: 'y',
        });
    });

    it('이미 캐시에 있어도 seed는 갱신한다 — 값이 이미 손에 있다', async () => {
        mocks.peekBriefingCache.mockResolvedValue({ briefing: 'x' });
        mocks.peekMacroBriefingCache.mockResolvedValue({ briefing: 'y' });
        mocks.peekMarketNewsDigestCache.mockResolvedValue({
            currentDriverKo: 'z',
        });

        const result = await runHubPrewarm();

        expect(result.alreadyFresh).toBe(hubTargets().length);
        expect(mocks.writeHubSsrSeed).toHaveBeenCalledWith('macro-briefing', {
            briefing: 'y',
        });
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
        expect(surfaces).toHaveLength(Object.keys(DASHBOARD_SCOPES).length + 1);
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
