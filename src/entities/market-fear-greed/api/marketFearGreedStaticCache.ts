import 'server-only';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { SECONDS_PER_HOUR } from '@/shared/config/time';
import { runWithRenderBudget } from '@/shared/lib/renderBudget';
import {
    getCachedMarketFearGreed,
    MARKET_FEAR_GREED_CONFIG_FINGERPRINT,
} from './marketFearGreedCache';
import type { MarketFearGreedView } from '../model';

/**
 * ISR-safe 미국 시장 공포·탐욕 판독값. Redis 계층을 Next 데이터 캐시로 감싸, 아래층
 * `no-store` FMP fetch가 정적 생성을 막지 않게 한다. `revalidate` 1h — 입력이 EOD 종가라
 * 값은 세션당 한 번 바뀌고, 1시간이 새 종가가 반영되기까지의 대기 상한이다.
 *
 * 전용 `market:fear-greed` 태그를 쓴다. `market:summary`·`sector:signals:<scopeId>`와
 * 분리해 한 화면을 재검증해도 다른 화면 캐시가 날아가지 않게 한다.
 *
 * `React.cache`로 감싸는 이유: `generateMetadata`와 페이지 본문이 한 요청 안에서 각각
 * 읽는데 둘의 답이 **일치해야** 한다. metadata는 `snapshot === null`로 `noindex`를 정하고
 * 본문은 같은 필드로 어떤 UI를 그릴지 정한다. 요청 내 메모가 없으면 두 호출이 캐시 만료
 * 경계의 양쪽에 떨어져 서로 다른 답을 볼 수 있다 — 색인되는 페이지가 빈 상태를 보여주거나
 * 그 반대. `unstable_cache`는 요청 간 정적화를 담당하지 요청 내 메모가 아니다.
 *
 * (FMP fan-out 자체는 한 층 아래 `getCachedMarketFearGreed`가 `React.cache`라 이미
 * 중복 제거된다 — 이 래퍼는 중복 업스트림 호출이 아니라 두 독자의 일치를 위한 것이다.)
 *
 * `economySnapshotStaticCache`와 같은 모양이고 이유도 같다. `/market`의
 * `getMarketSummaryStatic`은 `generateMetadata`가 요약을 읽지 않아 요청당 한 번만
 * 불리므로 일부러 `React.cache`를 두지 않는다.
 */
export const getMarketFearGreedStatic = cache(
    (): Promise<MarketFearGreedView> =>
        unstable_cache(
            // 렌더 예산: FMP가 느리면 짧게 실패해 degrade한다(`renderBudget.ts`).
            () => runWithRenderBudget(() => getCachedMarketFearGreed()),
            ['market-fear-greed-static', MARKET_FEAR_GREED_CONFIG_FINGERPRINT],
            { revalidate: SECONDS_PER_HOUR, tags: ['market:fear-greed'] }
        )()
);
