import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MarketFearGreedView } from '@/entities/market-fear-greed/model';
import { SECONDS_PER_HOUR } from '@/shared/config/time';

vi.mock('server-only', () => ({}));

const { mockUnstableCache } = vi.hoisted(() => ({
    mockUnstableCache: vi.fn(
        (
            fn: () => Promise<MarketFearGreedView>,
            _keys: unknown,
            _opts: unknown
        ) => fn
    ),
}));

vi.mock('next/cache', () => ({
    unstable_cache: mockUnstableCache,
}));

/**
 * `React.cache`는 React 요청 스코프 밖(=vitest node 환경)에서 메모하지 않고 그대로
 * 통과시킨다. 그래서 "두 번 불러 한 번만 실행되는지"로는 래퍼 유무를 검증할 수
 * 없다 — 래퍼를 지워도 통과한다. `cache`를 스파이로 갈아끼워 **감쌌다는 사실
 * 자체**를 고정한다.
 *
 * 이 래퍼가 왜 필요한가: `generateMetadata`와 본문이 한 요청 안에서 각각 읽는데,
 * 둘의 답이 갈리면 `snapshot === null`로 noindex를 정한 페이지가 실제로는 값을
 * 보여주거나 그 반대가 된다.
 */
const { mockReactCache } = vi.hoisted(() => ({
    // 통과만 시킨다 — 메모까지 흉내 내면 그 메모가 테스트 간에 살아남아
    // 순서 의존 실패를 만든다. 여기서 고정하려는 계약은 "감쌌는가" 하나다.
    mockReactCache: vi.fn(<T>(fn: T) => fn),
}));

vi.mock('react', async () => {
    const actual = await vi.importActual<typeof import('react')>('react');
    return { ...actual, cache: mockReactCache };
});

vi.mock('@/entities/market-fear-greed/api/marketFearGreedKrCache', () => ({
    getCachedMarketFearGreedKr: vi.fn(),
    MARKET_FEAR_GREED_KR_CONFIG_FINGERPRINT: 'kr0123456789',
}));

import { getMarketFearGreedKrStatic } from '@/entities/market-fear-greed/api/marketFearGreedKrStaticCache';
import { getCachedMarketFearGreedKr } from '@/entities/market-fear-greed/api/marketFearGreedKrCache';

const mockGetCachedMarketFearGreedKr = vi.mocked(getCachedMarketFearGreedKr);

const sampleView: MarketFearGreedView = {
    snapshot: {
        score: 56,
        label: 'NEUTRAL',
        factors: [],
        confidence: 'normal',
        sampleSize: 180,
        asOf: '2026-08-18',
    },
    comparisons: [],
};

describe('getMarketFearGreedKrStatic', () => {
    beforeEach(() => {
        // `mockReactCache`는 지우지 않는다 — 모듈 import 시점에 이미 한 번 호출돼
        // 래퍼를 만들었고, 여기서 지우면 그 래퍼의 메모까지 잃는 게 아니라
        // 호출 기록만 사라져 단언이 무의미해진다.
        mockUnstableCache.mockClear();
        mockGetCachedMarketFearGreedKr.mockClear();
    });

    it('(Happy) getCachedMarketFearGreedKr를 호출하고 결과를 반환한다', async () => {
        mockGetCachedMarketFearGreedKr.mockResolvedValue(sampleView);

        expect(await getMarketFearGreedKrStatic()).toBe(sampleView);
        expect(mockGetCachedMarketFearGreedKr).toHaveBeenCalledTimes(1);
    });

    /**
     * `React.cache` 래퍼가 있는지 검증한다 — **두 번 불러야 의미가 있다.**
     * `generateMetadata`와 본문이 한 요청 안에서 각각 읽는데, 둘의 답이 갈리면
     * `snapshot === null`로 noindex를 정한 페이지가 실제로는 값을 보여주거나
     * 그 반대가 된다. 한 번만 부르는 단언은 래퍼를 지워도 통과한다.
     */
    it('(Happy) React.cache로 감싼다 — 요청 내 metadata/본문 답 일치의 근거', () => {
        expect(mockReactCache).toHaveBeenCalledWith(expect.any(Function));
    });

    /**
     * 태그가 미국판(`market:fear-greed`)과 같으면 한쪽 무효화가 다른 쪽까지 날린다.
     */
    it('(Happy) unstable_cache opts: revalidate=3600, tags=[market:fear-greed:kr]', async () => {
        mockGetCachedMarketFearGreedKr.mockResolvedValue(sampleView);

        await getMarketFearGreedKrStatic();

        const [, , opts] = mockUnstableCache.mock.calls[0]!;
        expect(opts).toEqual({
            revalidate: SECONDS_PER_HOUR,
            tags: ['market:fear-greed:kr'],
        });
    });

    it('(Happy) 캐시 키가 kr 전용 prefix + fingerprint로 구성된다', async () => {
        mockGetCachedMarketFearGreedKr.mockResolvedValue(sampleView);

        await getMarketFearGreedKrStatic();

        const [, keys] = mockUnstableCache.mock.calls[0]!;
        expect(keys).toEqual(['market-fear-greed-kr-static', 'kr0123456789']);
    });

    it('(Worst) 아래층이 throw하면 에러가 그대로 전파된다', async () => {
        mockGetCachedMarketFearGreedKr.mockRejectedValue(
            new Error('yahoo chart failed')
        );

        await expect(getMarketFearGreedKrStatic()).rejects.toThrow(
            'yahoo chart failed'
        );
    });
});
