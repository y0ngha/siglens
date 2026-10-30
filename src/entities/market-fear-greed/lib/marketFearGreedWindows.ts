import { US_EQUITY_SESSION } from '@y0ngha/siglens-core';
import { MS_PER_DAY } from '@/shared/config/time';
import { toUtcIsoDate } from '@/shared/lib/isoDate';
import { lastClosedSessionDate } from '@/shared/lib/marketSessionDate';
import { MARKET_FEAR_GREED_CRYPTO_LOOKBACK_DAYS } from './marketFearGreedCryptoSymbols';
import { MARKET_FEAR_GREED_KR_LOOKBACK_DAYS } from './marketFearGreedKrSymbols';
import { MARKET_FEAR_GREED_LOOKBACK_DAYS } from './marketFearGreedSymbols';

/**
 * 미국 판독의 조회 창 하한(ISO `YYYY-MM-DD`). 캐시 계층이 한 번 계산해 여섯 시리즈
 * 전부에 같은 값을 넘긴다 — 시리즈별로 파생하면 UTC 자정을 걸친 요청이 시리즈마다
 * 다른 창을 받는다.
 */
export function lookbackStartDate(now: Date): string {
    return toUtcIsoDate(
        new Date(now.getTime() - MARKET_FEAR_GREED_LOOKBACK_DAYS * MS_PER_DAY)
    );
}

/**
 * 미국 판독의 조회 창 상한 — 실제로 마감·발행까지 끝난 마지막 세션.
 *
 * FMP EOD 엔드포인트는 진행 중인 세션에도 종가가 아닌 실시간 시세를 담은 행을 준다
 * (24시간 거래 심볼로 장중에 오늘 날짜 행이 오는 것을 확인했다). 이 상한이 없으면 지수가
 * 장중 틱을 먹고 하루 종일 흔들리면서 화면에는 "종가 기준"이라고 적히고, 값은 마지막 ISR
 * 재생성이 우연히 잡은 틱으로 굳는다.
 *
 * `lastClosedSessionDate`는 봉 EOD 캐시·sitemap `lastmod`와 같은 헬퍼라 발행 버퍼 4h,
 * 서머타임, 주말 되감기, NYSE 휴장·조기폐장 달력을 모두 따른다. `MARKET_FEAR_GREED_SYMBOLS`의
 * 모든 심볼이 미국 지수·ETF라 스펙은 `US_EQUITY_SESSION`으로 고정한다.
 */
export function lastPublishedSessionDate(now: Date): string {
    return lastClosedSessionDate(US_EQUITY_SESSION, now);
}

/**
 * 한국 판독의 조회 창 하한. 캐시 계층이 한 번 계산해 모든 시리즈에 같은 값을 넘긴다 —
 * 시리즈별로 파생하면 자정을 걸친 요청이 시리즈마다 다른 창을 받는다.
 */
export function krLookbackStartDate(now: Date): Date {
    return new Date(
        now.getTime() - MARKET_FEAR_GREED_KR_LOOKBACK_DAYS * MS_PER_DAY
    );
}

/** 크립토 판독의 조회 창 하한. 캐시 계층이 한 번 계산해 21개 시리즈 전부에 같은 값을 넘긴다. */
export function cryptoLookbackStartDate(now: Date): string {
    return toUtcIsoDate(
        new Date(
            now.getTime() - MARKET_FEAR_GREED_CRYPTO_LOOKBACK_DAYS * MS_PER_DAY
        )
    );
}

/**
 * 크립토 판독의 조회 창 상한 — 마지막으로 **완전히 닫힌** UTC 일(어제, UTC).
 *
 * FMP는 진행 중인 날에도 그날 날짜의 행을 주고 `close`에 실시간 시세를 넣는다. 오늘을
 * 포함하면 지수가 하루 종일 흔들리면서 화면에는 "종가 기준"이라고 적힌다 — 미국판이
 * `lastClosedSessionDate`로 막은 것과 같은 결함이다. 코인은 24시간 거래라 세션 달력
 * 대신 UTC 자정이 마감이다.
 */
export function lastClosedUtcDate(now: Date): string {
    return toUtcIsoDate(new Date(now.getTime() - MS_PER_DAY));
}
