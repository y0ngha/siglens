import 'server-only';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { SECONDS_PER_HOUR } from '@/shared/config/time';
import {
    getCachedMarketFearGreedCrypto,
    MARKET_FEAR_GREED_CRYPTO_CONFIG_FINGERPRINT,
} from './marketFearGreedCryptoCache';
import type { MarketFearGreedCryptoView } from '../model';

/**
 * ISR-safe 암호화폐 시장 공포·탐욕 판독값. 미국·한국판과 같은 3중 래핑이고 이유도 같다.
 *
 * - `unstable_cache`: 아래층 FMP fetch가 `no-store`라 정적 생성이 막히는 것을 푼다.
 * - 태그 `market:fear-greed:crypto` — 두 형제 캐시와 같은 `market:fear-greed` 계열이되,
 *   한국판처럼 지역 접미사로 따로 무효화할 수 있게 둔다.
 * - `React.cache`: `generateMetadata`(noindex 판정)와 본문이 한 요청 안에서 같은 답을
 *   봐야 한다. 요청 내 메모가 없으면 캐시 만료 경계 양쪽에 떨어져 서로 다른 답을 본다.
 */
export const getMarketFearGreedCryptoStatic = cache(
    (): Promise<MarketFearGreedCryptoView> =>
        unstable_cache(
            () => getCachedMarketFearGreedCrypto(),
            [
                'market-fear-greed-crypto-static',
                MARKET_FEAR_GREED_CRYPTO_CONFIG_FINGERPRINT,
            ],
            {
                revalidate: SECONDS_PER_HOUR,
                tags: ['market:fear-greed:crypto'],
            }
        )()
);
