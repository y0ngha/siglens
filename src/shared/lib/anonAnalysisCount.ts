import {
    LOCAL_STORAGE_ANON_ANALYZED_SYMBOLS_KEY,
    LOCAL_STORAGE_ANON_NUDGE_SHOWN_KEY,
} from '@/shared/lib/storageKeys';

/**
 * Anonymous distinct-symbol analysis counter — member-reasoning-toggle spec
 * Part B. Purely client-side (localStorage); the counter is a soft nudge, not
 * a hard limit, so there is no server-side source of truth and no need for
 * one (§4 "소프트 넙지라 localStorage 조작 우회 허용").
 */

/** Threshold of distinct symbols analyzed in a day that triggers the signup nudge. */
export const ANON_DISTINCT_SYMBOL_NUDGE_THRESHOLD = 3;

interface AnonAnalyzedSymbolsRecord {
    dateUtc: string;
    symbols: string[];
}

interface AnonNudgeShownRecord {
    dateUtc: string;
}

/** `YYYY-MM-DD` in UTC — the day boundary the counter and nag-prevention flag both reset on. */
function todayUtc(now: Date): string {
    return now.toISOString().slice(0, 10);
}

function readAnalyzedSymbolsRecord(): AnonAnalyzedSymbolsRecord | null {
    const raw = localStorage.getItem(LOCAL_STORAGE_ANON_ANALYZED_SYMBOLS_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
        typeof parsed !== 'object' ||
        parsed === null ||
        !('dateUtc' in parsed) ||
        !('symbols' in parsed) ||
        typeof (parsed as { dateUtc: unknown }).dateUtc !== 'string' ||
        !Array.isArray((parsed as { symbols: unknown }).symbols)
    ) {
        return null;
    }
    return parsed as AnonAnalyzedSymbolsRecord;
}

export interface RecordAnonSymbolAnalysisResult {
    /** Distinct symbols analyzed so far today (after recording this one). */
    distinctCount: number;
    /**
     * `true` only on the call that first reaches the nudge threshold — never
     * re-fires on subsequent calls the same day, so the caller can use this
     * as a one-shot "show the modal now" signal (nag-prevention still applies
     * on top via `hasNudgeShownToday`/`markNudgeShownToday`).
     */
    crossedThreshold: boolean;
}

/**
 * Records a symbol as analyzed by an anonymous visitor today (UTC), deduping
 * by symbol. SSR-safe (`typeof window` guard) and resilient to a blocked/
 * unavailable localStorage (private browsing, storage quota, etc.) — any
 * failure degrades to a no-op `{ distinctCount: 0, crossedThreshold: false }`
 * rather than throwing, since this is a soft nudge and must never break the
 * analysis flow it observes.
 *
 * @param symbol - Ticker just analyzed (case-insensitive; normalized to upper).
 * @param now - Injectable clock for deterministic tests. Defaults to `new Date()`.
 */
export function recordAnonSymbolAnalysis(
    symbol: string,
    now: Date = new Date()
): RecordAnonSymbolAnalysisResult {
    if (typeof window === 'undefined') {
        return { distinctCount: 0, crossedThreshold: false };
    }

    try {
        const today = todayUtc(now);
        const stored = readAnalyzedSymbolsRecord();
        const previousSymbols =
            stored !== null && stored.dateUtc === today ? stored.symbols : [];

        const upperSymbol = symbol.toUpperCase();
        const distinctCountBefore = previousSymbols.length;
        const symbols = previousSymbols.includes(upperSymbol)
            ? previousSymbols
            : [...previousSymbols, upperSymbol];
        const distinctCount = symbols.length;

        const record: AnonAnalyzedSymbolsRecord = { dateUtc: today, symbols };
        localStorage.setItem(
            LOCAL_STORAGE_ANON_ANALYZED_SYMBOLS_KEY,
            JSON.stringify(record)
        );

        const crossedThreshold =
            distinctCountBefore < ANON_DISTINCT_SYMBOL_NUDGE_THRESHOLD &&
            distinctCount >= ANON_DISTINCT_SYMBOL_NUDGE_THRESHOLD;

        return { distinctCount, crossedThreshold };
    } catch {
        // localStorage blocked (private browsing) or corrupted JSON — degrade
        // to a no-op rather than crash the analysis flow.
        return { distinctCount: 0, crossedThreshold: false };
    }
}

/**
 * Whether the signup nudge has already been shown today (UTC) —
 * nag-prevention companion to `recordAnonSymbolAnalysis`. Resets on UTC date
 * change, same boundary as the symbol counter. SSR-safe + storage-blocked
 * safe (degrades to `false`, i.e. "not shown", which is the more conservative
 * default here since this is only ever read right before deciding whether to
 * open the modal — a false negative just means the modal may show once more
 * than ideal, never a functional break).
 */
export function hasNudgeShownToday(now: Date = new Date()): boolean {
    if (typeof window === 'undefined') return false;
    try {
        const raw = localStorage.getItem(LOCAL_STORAGE_ANON_NUDGE_SHOWN_KEY);
        if (raw === null) return false;
        const parsed: unknown = JSON.parse(raw);
        if (
            typeof parsed !== 'object' ||
            parsed === null ||
            !('dateUtc' in parsed) ||
            typeof (parsed as { dateUtc: unknown }).dateUtc !== 'string'
        ) {
            return false;
        }
        return (parsed as AnonNudgeShownRecord).dateUtc === todayUtc(now);
    } catch {
        return false;
    }
}

/** Marks the signup nudge as shown for today (UTC). SSR-safe + storage-blocked safe (no-op). */
export function markNudgeShownToday(now: Date = new Date()): void {
    if (typeof window === 'undefined') return;
    try {
        const record: AnonNudgeShownRecord = { dateUtc: todayUtc(now) };
        localStorage.setItem(
            LOCAL_STORAGE_ANON_NUDGE_SHOWN_KEY,
            JSON.stringify(record)
        );
    } catch {
        // storage blocked — nothing to do; worst case the nudge may re-show.
    }
}
