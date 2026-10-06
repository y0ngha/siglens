import 'server-only';
import { cache } from 'react';
import {
    __resetMemoryLruForTests,
    createMemoryLru,
} from '@/shared/cache/memoryLru';
import {
    __resetSingleFlightForTests,
    createSingleFlight,
} from '@/shared/lib/singleFlight';
import { MS_PER_SECOND } from '@/shared/config/time';
import {
    type BarsData,
    type MarketDataProvider,
    type MarketSessionSpec,
    type Timeframe,
    US_EQUITY_SESSION,
    fetchBarsWithIndicators,
    computeBarsEffectiveTtl,
} from '@y0ngha/siglens-core';

/**
 * 메모리에 둘 파생 봉 데이터(봉+지표+공포·탐욕용 5년 일봉) 개수 상한.
 *
 * 일봉 항목 하나가 힙에서 약 1.1MB다(2026-10 실측: 봉 522개 + 지표 39종 + 5년 일봉
 * 1,357개; 봉 객체는 provider 히스토리 캐시와 공유되므로 대부분이 지표 배열이다).
 * 인트라데이 항목은 그보다 작다. 48개면 최악 ~55MB로 t4g.medium(4GB)에 부담이 없고,
 * 장중 동시에 뜨거운 종목(~30개 × 주 timeframe)을 덮는다.
 */
export const BARS_MEMORY_MAX_ENTRIES = 48;

/** fmpSymbol이 OHLCV 결과를 바꾸므로(예: '^SPX' vs 'SPX') 키에 포함. */
function buildBarsKey(
    symbol: string,
    timeframe: Timeframe,
    fmpSymbol?: string
): string {
    const suffix = fmpSymbol ? `:${fmpSymbol.toUpperCase()}` : '';
    return `bars:${symbol.toUpperCase()}:${timeframe}${suffix}`;
}

const barsMemory = createMemoryLru<BarsData>(BARS_MEMORY_MAX_ENTRIES);
const barsInFlight = createSingleFlight<BarsData>();

/**
 * OHLCV+지표를 메모리 → provider 순으로 가져온다.
 *
 * 캐시 레이어:
 *   1. React.cache — 요청 내 dedup(layout/page가 같은 TF prefetch 시 1회).
 *   2. 인스턴스 메모리 LRU(`BARS_MEMORY_MAX_ENTRIES`) — 시장 세션별 TTL(core
 *      `computeBarsEffectiveTtl`: 장중 60초, 장외는 다음 개장까지). 같은 키의 동시
 *      miss는 `createSingleFlight`로 한 번의 계산에 접힌다.
 *   3. provider(`CachedMarketDataProvider`)의 Redis 캐시 — 원재료 봉만 담는다. 일봉은
 *      세션 날짜로 롤되는 히스토리(`bars:eodhist`) + 60초 오늘 봉(`bars:today`),
 *      인트라데이도 같은 모양(`bars:intrahist` + 오늘 tail)이라 장중 1분마다 다시
 *      받는 것은 작은 live 부분뿐이다.
 *
 * ## 왜 파생 값을 더는 Redis에 두지 않는가 (2026-10)
 *
 * 예전에는 결과 전체(`bars:v2:<SYM>:<tf>`)를 Redis에 60초 TTL로 썼다. 값이 봉 + 지표
 * 39종 + 5년 일봉이라 원본 ~658KB / zstd+base64 ~216KB였고, 장중에는 활성 종목마다
 * **매분 다시 계산해 다시 SET**했다(뜨거운 종목 ~30개면 하루 ~2.5GB egress). 클라이언트
 * `getBarsAction` 재조회도 같은 값을 매번 GET했다. 그런데 이 값은 원재료 봉의 순수
 * 함수이고, 원재료는 이미 provider 계층에서 "무거운 과거(세션 롤 TTL) + 가벼운 오늘
 * (60초)"로 나뉘어 Redis에 있다. 그래서 파생 값은 인스턴스 메모리에만 두고, 매분 다시
 * 받는 것은 오늘 봉 하나로 줄였다. 지표 재계산은 일봉 기준 ~20ms다.
 *
 * 돌려주는 데이터는 같다: 같은 core 함수를 같은 provider로 부르고, 신선도 상한도
 * 예전 Redis TTL과 같은 값을 메모리 TTL로 쓴다. 운영이 인스턴스 한 대라 교차 인스턴스
 * 공유를 잃는 비용은 롤링 배포 구간의 재계산 정도다. 옛 `bars:v2:*` 키는 TTL(최대
 * 24h)로 저절로 사라진다.
 *
 * 에러는 캐시하지 않는다(provider throw → 저장 전에 전파). 빈 봉도 캐시하지 않는다 —
 * transient 장애를 TTL 동안 굳히지 않도록.
 */
export const getCachedBarsWithIndicators = cache(
    async (
        provider: MarketDataProvider,
        symbol: string,
        timeframe: Timeframe,
        fmpSymbol?: string,
        session: MarketSessionSpec = US_EQUITY_SESSION
    ): Promise<BarsData> => {
        const key = buildBarsKey(symbol, timeframe, fmpSymbol);
        const hit = barsMemory.get(key);
        if (hit !== undefined) return hit;
        return barsInFlight.run(key, async () => {
            // TTL은 계산을 시작한 시각 기준 — 예전 Redis 경로가 set 직전에 재던 것과 같은 정책.
            const ttlMs =
                computeBarsEffectiveTtl(timeframe, new Date(), session) *
                MS_PER_SECOND;
            // Retry(429/5xx + network)는 provider의 fmpGet(FMP_TRANSIENT_RETRY)에서 처리.
            const fresh = await fetchBarsWithIndicators(
                provider,
                symbol,
                timeframe,
                fmpSymbol
            );
            if (fresh.bars.length > 0) barsMemory.set(key, fresh, ttlMs);
            return fresh;
        });
    }
);

/** 테스트 전용 — 메모리 LRU와 in-flight 맵을 비운다. */
export function __resetBarsMemoryForTests(): void {
    __resetMemoryLruForTests(barsMemory);
    __resetSingleFlightForTests(barsInFlight);
}
