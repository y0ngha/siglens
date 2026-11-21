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
 * 3이다. 이미 캐시된 분석은 즉시 그려지므로 문턱이 1이던 때(PR #1002)는 첫 방문 화면이
 * 뜬 지 약 1.5초 만에 모달이 덮었다.
 * 하루 1회 상한은 `hasNudgeShownToday`가 맡는다.
 */
export const ANON_DISTINCT_SYMBOL_NUDGE_THRESHOLD = 3;

/** 가입 넛지 모달 문구 종류 — 같은 모달이 두 기능을 하나씩 알린다. */
export type SignupNudgeVariant = 'reasoning' | 'emailReport';

/** 자동 넛지가 보여 줄 문구 순서. 문구마다 한 번씩만 보여 주고, 다 보여 주면 더 띄우지 않는다. */
export const ANON_NUDGE_VARIANT_ORDER = [
    'emailReport',
    'reasoning',
] as const satisfies readonly SignupNudgeVariant[];

/**
 * 다음 문구를 고르고 기록한다. 더 보여 줄 문구가 없거나, 기록이 알 수 없는 값이거나, 저장소를 못 쓰면
 * `null`. 저장소를 못 쓰면 이미 보여 줬는지 알 수 없어 같은 문구가 반복될 수 있으므로 띄우지 않는다.
 * 기록이 없으면(첫 넛지) 메일 리포트부터 보여 준다.
 */
export function claimNextAnonNudgeVariant(): SignupNudgeVariant | null {
    if (typeof window === 'undefined') return null;
    try {
        const last = localStorage.getItem(LOCAL_STORAGE_ANON_NUDGE_VARIANT_KEY);
        const lastIndex =
            last === null
                ? -1
                : ANON_NUDGE_VARIANT_ORDER.findIndex(v => v === last);
        if (last !== null && lastIndex === -1) return null;
        const next = ANON_NUDGE_VARIANT_ORDER[lastIndex + 1];
        if (next === undefined) return null;
        localStorage.setItem(LOCAL_STORAGE_ANON_NUDGE_VARIANT_KEY, next);
        return next;
    } catch {
        return null;
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
