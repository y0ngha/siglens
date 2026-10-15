import {
    type ExtendedBarTimeframe,
    isExtendedBarTimeframe,
} from '@/shared/api/market/extendedBarsSession';
import { isAdmissibleSymbolShape } from '@/shared/config/ticker';
import { ISO_DATE_LENGTH, MS_PER_DAY } from '@/shared/config/time';

/** `SYMBOL_EDGE_RE`가 허용하는 최대 길이 — 정규식 전에 길이부터 본다(SERVER.md#SA-7). */
const SYMBOL_MAX_LENGTH = 16;

export interface ExtendedBarsRequest {
    /** 대문자로 정규화한 앱 심볼. */
    ticker: string;
    timeframe: ExtendedBarTimeframe;
}

function normalizeSymbol(value: unknown): string | null {
    if (typeof value !== 'string' || value.length > SYMBOL_MAX_LENGTH) {
        return null;
    }
    const upper = value.toUpperCase();
    return isAdmissibleSymbolShape(upper) ? upper : null;
}

/**
 * 확장 봉 요청 입력 검증(타입 → 크기 → 형식 순서, SERVER.md#SA-7). 하나라도 어긋나면 `null` —
 * 호출부는 I/O 없이 곧바로 degrade한다. 심볼 형식은 페이지가 쓰는 허용 판정(`isAdmissibleSymbolShape`)과
 * 같다.
 *
 * 조회할 FMP 심볼은 요청에 없다 — 서버가 푼 자산(`asset.fmpSymbol ?? ticker`)이 정한다. 클라이언트 값을 받으면
 * 아무 심볼의 확장 봉을 FMP에서 끌어오는 통로가 된다.
 */
export function parseExtendedBarsRequest(
    symbol: unknown,
    timeframe: unknown
): ExtendedBarsRequest | null {
    const ticker = normalizeSymbol(symbol);
    if (ticker === null || !isExtendedBarTimeframe(timeframe)) return null;
    return { ticker, timeframe };
}

/**
 * 타임프레임별 조회 창(일). 정규장 봉이 쓰는 core 상수(`TIMEFRAME_LOOKBACK_DAYS`)와 같은 값이다 —
 * core가 공개 export하지 않아 여기 둔다. 어긋나도 안전하다: 클라이언트 병합(`mergeExtendedBars`)이
 * 정규 봉의 첫 거래일보다 앞선 확장 봉을 버린다.
 */
export const EXTENDED_BARS_LOOKBACK_DAYS: Record<ExtendedBarTimeframe, number> =
    {
        '5Min': 10,
        '15Min': 20,
        '30Min': 30,
        '1Hour': 60,
        '4Hour': 200,
    };

/** 정규장 봉 조회(`fetchBarsWithIndicators`)와 같은 형태의 `from`(UTC 자정 ISO 문자열). */
export function extendedBarsFrom(
    timeframe: ExtendedBarTimeframe,
    now: Date
): string {
    const from = new Date(
        now.getTime() - EXTENDED_BARS_LOOKBACK_DAYS[timeframe] * MS_PER_DAY
    );
    return `${from.toISOString().slice(0, ISO_DATE_LENGTH)}T00:00:00Z`;
}
