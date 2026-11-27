import type { Timeframe } from '@y0ngha/siglens-core';

export const DEFAULT_TIMEFRAME: Timeframe = '1Day';

/** `[symbol]` 동적 라우트의 params 형태 (generateStaticParams 반환 타입 등에 사용). */
export type SymbolRouteParams = { symbol: string };

export const TIMEFRAMES: readonly Timeframe[] = [
    '5Min',
    '15Min',
    '30Min',
    '1Hour',
    '4Hour',
    '1Day',
];

/**
 * 서버 진입점이 받아 주는 주기인지. core 3.0.0 `TIER_CONFIG`는 이미 member·pro에 '1Week'를 열었지만
 * 주봉을 내는 화면이 아직 없어, 직접 호출(스트림·서버 액션)을 `TIMEFRAMES` 밖이라며 거른다.
 * 주봉 화면을 공개할 때 제거한다 — 이 함수와 호출부의 거절을 없애고 `TIMEFRAMES`에 1Week를 넣는다.
 */
export function isServedTimeframe(
    value: string | undefined | null
): value is Timeframe {
    return isValidTimeframe(value);
}

export function isValidTimeframe(
    value: string | undefined | null
): value is Timeframe {
    if (!value) return false;
    return TIMEFRAMES.some(timeframe => timeframe === value);
}
