import 'server-only';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { SECONDS_PER_HOUR } from '@/shared/config/time';
import {
    getCachedMarketFearGreedKr,
    MARKET_FEAR_GREED_KR_CONFIG_FINGERPRINT,
} from './marketFearGreedKrCache';
import type { MarketFearGreedView } from '../model';

/**
 * ISR-safe 한국 시장 공포·탐욕 판독값. 미국판(`marketFearGreedStaticCache`)과 같은
 * 3중 래핑이고, 이유도 같다.
 *
 * - `unstable_cache`: 아래층 yahoo fetch가 `no-store`라 정적 생성이 막히는 것을 푼다.
 *   `revalidate` 1h — 입력이 EOD 종가라 값은 세션당 한 번 바뀌고, 1시간이 새 종가가
 *   반영되기까지의 대기 상한이다.
 * - 전용 태그 `market:fear-greed:kr` — 미국 판독값과 따로 무효화할 수 있어야 한다.
 * - `React.cache`: `generateMetadata`와 본문이 한 요청 안에서 각각 읽는데, 둘의 답이
 *   **일치해야** 한다. metadata는 `snapshot === null`로 noindex를 정하고 본문은 같은
 *   필드로 어떤 UI를 그릴지 정한다. 요청 내 메모가 없으면 두 호출이 캐시 만료 경계의
 *   양쪽에 떨어져 서로 다른 답을 볼 수 있다 — 색인되는 페이지가 빈 상태를 보여주거나
 *   그 반대. `unstable_cache`는 요청 간 정적화를 담당하지 요청 내 메모가 아니다.
 */
export const getMarketFearGreedKrStatic = cache(
    (): Promise<MarketFearGreedView> =>
        unstable_cache(
            () => getCachedMarketFearGreedKr(),
            [
                'market-fear-greed-kr-static',
                MARKET_FEAR_GREED_KR_CONFIG_FINGERPRINT,
            ],
            { revalidate: SECONDS_PER_HOUR, tags: ['market:fear-greed:kr'] }
        )()
);
