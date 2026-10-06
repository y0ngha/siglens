import 'server-only';
import {
    type MarketDataProvider,
    type MarketSessionSpec,
    US_EQUITY_SESSION,
    CRYPTO_SESSION,
} from '@y0ngha/siglens-core';
import { getMarketDataProvider } from './getMarketDataProvider';
import { CachedMarketDataProvider } from './CachedMarketDataProvider';
import { KR_EQUITY_SESSION } from './sessionSpecFor';
import { YahooMarketProvider } from '@/shared/api/yahoo/YahooMarketProvider';
import { FMP_EXCHANGE_TIME_ZONE } from '@/shared/api/fmp/FmpMarketProvider';
import { isE2E } from '@/shared/api/e2eEnv';

/**
 * FMP를 감싸는 캐시 provider의 옵션. FMP `historical-chart`는 `from`/`to`를 미 동부 날짜로
 * 해석하므로 인트라데이를 "어제까지 + 오늘 tail"로 나눠 캐시할 수 있다. KR(yahoo)은 날짜
 * 의미가 달라 이 옵션 없이 단일 키 경로를 쓴다.
 *
 * 인트라데이 분할이 켜지는 곳은 여기(US·크립토 두 싱글톤)뿐이다. 크립토도 같은 FMP
 * provider라 미 동부 날짜 경계로 나뉜다 — 24/7 시장에 "ET 자정"은 의미 없는 경계지만 결과는
 * 단일 키 경로와 같다. 히스토리는 `fmpIntradayDateToUtcSeconds`(FMP 시각 문자열을 ET로 읽음)를
 * 거친 봉을 다시 ET 날짜로 걸러 "FMP 문자열 날짜 < today"만 남기고, tail은 FMP `from=today`
 * (포함)다. 전제는 FMP가 `from`을 응답 시각 문자열과 같은 달력으로 해석한다는 것뿐이고, 그러면
 * 두 구간이 FMP 날짜 기준으로 정확히 나뉜다. FMP가 크립토 `from`을 그보다 이른 경계(예: UTC
 * 자정)로 해석해 tail이 전날 봉을 더 담더라도 겹침일 뿐이고
 * `mergeBarsByTime`이 시각으로 중복을 지운다(tail 우선 — 같은 봉이라 값도 같다). 경계
 * 위치는 캐시 키를 하루 단위로 정규화하는 데만 쓰인다.
 */
const FMP_PROVIDER_OPTIONS = {
    intradayDateTimeZone: FMP_EXCHANGE_TIME_ZONE,
} as const;

let cached: MarketDataProvider | null = null;
let cachedCrypto: MarketDataProvider | null = null;
let cachedKrEquity: MarketDataProvider | null = null;

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
    if (session === KR_EQUITY_SESSION) {
        // FMP 플랜에 KRX가 포함되지 않아 provider 자체가 다르다 — 크립토가 세션만
        // 바꿔 같은 FmpMarketProvider를 감싸는 것과 다른 지점이다.
        if (cachedKrEquity !== null) return cachedKrEquity;
        cachedKrEquity = new CachedMarketDataProvider(
            new YahooMarketProvider(),
            KR_EQUITY_SESSION
        );
        return cachedKrEquity;
    }
    if (session === CRYPTO_SESSION) {
        if (cachedCrypto !== null) return cachedCrypto;
        cachedCrypto = new CachedMarketDataProvider(
            getMarketDataProvider(),
            CRYPTO_SESSION,
            FMP_PROVIDER_OPTIONS
        );
        return cachedCrypto;
    }
    if (cached !== null) return cached;
    // 생성자 기본값에 기대지 않고 명시적으로 넘긴다 — 기본값에 기대면 어떤 스펙이
    // 쓰이는지 밖에서 관측할 수 없어 배선이 테스트로 고정되지 않는다(감사 라운드 13).
    cached = new CachedMarketDataProvider(
        getMarketDataProvider(),
        US_EQUITY_SESSION,
        FMP_PROVIDER_OPTIONS
    );
    return cached;
}
