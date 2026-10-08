import {
    LOCAL_STORAGE_ANON_ANALYZED_SYMBOLS_KEY,
    LOCAL_STORAGE_ANON_NUDGE_SHOWN_KEY,
    LOCAL_STORAGE_ANON_NUDGE_VARIANT_KEY,
} from '@/shared/lib/storageKeys';
import { toUtcIsoDate } from '@/shared/lib/isoDate';

/**
 * Anonymous distinct-symbol analysis counter — member-reasoning-toggle spec
 * Part B. Purely client-side (localStorage); the counter is a soft nudge, not
 * a hard limit, so there is no server-side source of truth and no need for
 * one (§4 "소프트 넙지라 localStorage 조작 우회 허용").
 */

/**
 * Threshold of distinct symbols analyzed in a day that triggers the signup nudge.
 *
 * 1이다 — 그날 첫 분석이 화면에 그려지면 띄운다(하루 1회 상한은 `hasNudgeShownToday`).
 * 예전엔 3이었는데, 메일 리포트를 알리면서 문턱을 낮췄다. 페이지에 들어오자마자가
 * 아니라 분석이 렌더된 뒤에 세므로, 첫 방문자가 내용을 보기 전에 모달이 막지 않는다.
 */
export const ANON_DISTINCT_SYMBOL_NUDGE_THRESHOLD = 1;

/** 가입 넛지 모달 문구 종류 — 같은 모달이 두 기능을 번갈아 알린다. */
export type SignupNudgeVariant = 'reasoning' | 'emailReport';

/**
 * 이번 자동 넛지에 보여 줄 문구를 고르고 기록한다. 직전과 다른 문구를 고른다 — 매번 같은
 * 모달을 보면 사용자가 읽지 않고 닫는다. 기록이 없으면(첫 넛지) 메일 리포트부터 보여 준다.
 * 저장소가 막혀 있으면 메일 리포트로 고정된다.
 */
export function nextAnonNudgeVariant(): SignupNudgeVariant {
    if (typeof window === 'undefined') return 'emailReport';
    try {
        const last = localStorage.getItem(LOCAL_STORAGE_ANON_NUDGE_VARIANT_KEY);
        const next: SignupNudgeVariant =
            last === 'emailReport' ? 'reasoning' : 'emailReport';
        localStorage.setItem(LOCAL_STORAGE_ANON_NUDGE_VARIANT_KEY, next);
        return next;
    } catch {
        return 'emailReport';
    }
}

interface AnonAnalyzedSymbolsRecord {
    dateUtc: string;
    symbols: string[];
}

interface AnonNudgeShownRecord {
    dateUtc: string;
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
        !Array.isArray((parsed as { symbols: unknown }).symbols) ||
        !(parsed as { symbols: unknown[] }).symbols.every(
            s => typeof s === 'string'
        )
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
        const today = toUtcIsoDate(now);
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
        return (parsed as AnonNudgeShownRecord).dateUtc === toUtcIsoDate(now);
    } catch {
        return false;
    }
}

/** Marks the signup nudge as shown for today (UTC). SSR-safe + storage-blocked safe (no-op). */
export function markNudgeShownToday(now: Date = new Date()): void {
    if (typeof window === 'undefined') return;
    try {
        const record: AnonNudgeShownRecord = { dateUtc: toUtcIsoDate(now) };
        localStorage.setItem(
            LOCAL_STORAGE_ANON_NUDGE_SHOWN_KEY,
            JSON.stringify(record)
        );
    } catch {
        // storage blocked — nothing to do; worst case the nudge may re-show.
    }
}
