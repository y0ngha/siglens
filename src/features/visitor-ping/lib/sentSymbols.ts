/**
 * `SymbolViewPing`의 하루 한 번 중복 방지 기록 — 저장 형식의 읽기·쓰기만 담은 순수 함수.
 * `localStorage` 접근은 컴포넌트가 한다.
 */

/** 오늘(KST) 이미 보낸 심볼 목록을 담는 `localStorage` 키. 날짜가 바뀌면 버린다. */
export const SYMBOL_VIEWS_STORAGE_KEY = 'siglens:symbol-views';

/** 저장되는 값의 형태: 기록한 KST 날짜와 그날 보낸 심볼들. */
interface SentToday {
    date: string;
    symbols: string[];
}

function isSentToday(value: unknown): value is SentToday {
    if (typeof value !== 'object' || value === null) return false;
    const { date, symbols } = value as Partial<SentToday>;
    return typeof date === 'string' && Array.isArray(symbols);
}

/**
 * 저장된 원문에서 `today`에 이미 보낸 심볼을 꺼낸다. 값이 없거나, 깨졌거나, 다른 날짜면
 * 빈 배열이다 — 그러면 한 번 더 보낼 뿐이고 중복은 서버 임계값이 흡수한다.
 */
export function parseSentSymbols(raw: string | null, today: string): string[] {
    if (raw === null) return [];
    try {
        const parsed: unknown = JSON.parse(raw);
        return isSentToday(parsed) && parsed.date === today
            ? parsed.symbols
            : [];
    } catch {
        return [];
    }
}

/** `today` 기록에 `symbol`을 덧붙인 저장용 원문을 만든다. */
export function serializeSentSymbols(
    today: string,
    sent: readonly string[],
    symbol: string
): string {
    const next: SentToday = { date: today, symbols: [...sent, symbol] };
    return JSON.stringify(next);
}
