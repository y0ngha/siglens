import type { Timeframe } from '@y0ngha/siglens-core';
export { isAdmissibleSymbolShape } from './ticker';

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

export function isValidTimeframe(
    value: string | undefined | null
): value is Timeframe {
    if (!value) return false;
    return (TIMEFRAMES as readonly string[]).includes(value);
}
