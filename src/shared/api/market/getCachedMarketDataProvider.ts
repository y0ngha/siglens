import 'server-only';
import {
    type MarketDataProvider,
    type MarketSessionSpec,
    US_EQUITY_SESSION,
    CRYPTO_SESSION,
} from '@y0ngha/siglens-core';
import { getMarketDataProvider } from './getMarketDataProvider';
import { CachedMarketDataProvider } from './CachedMarketDataProvider';
import { isE2E } from '@/shared/api/e2eEnv';

let cached: MarketDataProvider | null = null;
let cachedCrypto: MarketDataProvider | null = null;

/**
 * 분석/차트 경로 전용 Redis 캐시 provider(싱글톤).
 *
 * `getMarketDataProvider()`(raw FMP provider, market summary/sector가 사용)는 그대로
 * 두고, 분석/차트 경로에만 이 캐시 데코레이터를 주입한다 — market-isr 작업과 공유
 * 파일을 만들지 않기 위함. E2E에서는 FakeMarketProvider(Redis 미설정이라 데코레이터
 * 무의미)를 그대로 반환한다.
 *
 * `session`은 core의 `MarketSessionSpec`으로 시장 세션 특성을 기술한다.
 * crypto는 `CRYPTO_SESSION`, us-equity는 `US_EQUITY_SESSION`(기본값).
 * 두 세션 값은 모듈-레벨 상수이므로 참조 동일성으로 분기할 수 있다 — 싱글톤 분리에 사용.
 */
export function getCachedMarketDataProvider(
    session: MarketSessionSpec = US_EQUITY_SESSION
): MarketDataProvider {
    if (isE2E()) return getMarketDataProvider();
    if (session === CRYPTO_SESSION) {
        if (cachedCrypto !== null) return cachedCrypto;
        cachedCrypto = new CachedMarketDataProvider(
            getMarketDataProvider(),
            CRYPTO_SESSION
        );
        return cachedCrypto;
    }
    if (cached !== null) return cached;
    cached = new CachedMarketDataProvider(getMarketDataProvider());
    return cached;
}
