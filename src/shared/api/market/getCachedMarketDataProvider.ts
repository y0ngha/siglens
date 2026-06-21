import 'server-only';
import type { MarketDataProvider } from '@y0ngha/siglens-core';
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
 * `alwaysOpen=true` 시 크립토 24/7 시장용 짧은 고정 TTL을 사용한다 (Plan 4에서
 * core MarketSessionSpec으로 교체 예정).
 */
export function getCachedMarketDataProvider(
    alwaysOpen = false
): MarketDataProvider {
    if (isE2E()) return getMarketDataProvider();
    if (alwaysOpen) {
        if (cachedCrypto !== null) return cachedCrypto;
        cachedCrypto = new CachedMarketDataProvider(
            getMarketDataProvider(),
            true
        );
        return cachedCrypto;
    }
    if (cached !== null) return cached;
    cached = new CachedMarketDataProvider(getMarketDataProvider());
    return cached;
}
