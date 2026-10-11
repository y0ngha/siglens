import { validateWatchlistSymbol } from '@/entities/watchlist/lib/validateWatchlistSymbol';

export type ParseReportSymbolInputResult =
    | { ok: true; symbol: string }
    | { ok: false };

/**
 * Server Action 인자는 선언 타입과 무관하게 클라이언트가 임의 JSON을 보낼 수 있다. 모양을
 * 좁히고 심볼을 정규화(공백 제거·대문자·사이트 전역 admission 형상)한다 — 관심종목과 같은 검증기.
 */
export function parseReportSymbolInput(
    input: unknown
): ParseReportSymbolInputResult {
    if (typeof input !== 'object' || input === null) return { ok: false };
    const { symbol } = input as Record<string, unknown>;
    if (typeof symbol !== 'string') return { ok: false };
    const validated = validateWatchlistSymbol(symbol);
    return validated.ok
        ? { ok: true, symbol: validated.symbol }
        : { ok: false };
}
