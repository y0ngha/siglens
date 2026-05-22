/**
 * U.S. equity options regular-session calendar math, shared between
 * client components (`OptionsPageClient`) and the infrastructure-layer
 * cache profile (`infrastructure/options/optionsCacheLife`).
 *
 * Originally lived in `lib/marketSession` (client-safe helpers only), but the
 * same constants + ET-parts extraction were duplicated in `optionsCacheLife`.
 * Promoted to `domain/market` so both call sites import a single source of
 * truth — `lib/` is reserved for thin UI utility wrappers, and this module
 * encodes a business rule (regular-session boundary) so it belongs in domain.
 *
 * The boundary is ET weekdays — see MARKET_OPEN_HOUR / MARKET_OPEN_MINUTE /
 * MARKET_CLOSE_HOUR. We resolve EDT/EST via
 * `Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York' })` so the
 * answer stays in lockstep with the market regardless of DST.
 */

import { MINUTES_PER_HOUR } from '@/domain/constants/time';
import type { OptionsSnapshot } from '@y0ngha/siglens-core';

// US equity options regular session — see MARKET_OPEN_HOUR / MARKET_OPEN_MINUTE / MARKET_CLOSE_HOUR.
export const MARKET_OPEN_HOUR = 9;
export const MARKET_OPEN_MINUTE = 30;
export const MARKET_CLOSE_HOUR = 16;

export const MARKET_OPEN_MIN =
    MARKET_OPEN_HOUR * MINUTES_PER_HOUR + MARKET_OPEN_MINUTE;
export const MARKET_CLOSE_MIN = MARKET_CLOSE_HOUR * MINUTES_PER_HOUR;

// Reads ET weekday/hour/minute from formatToParts directly. The previous
// implementation round-tripped through `toLocaleString` + `new Date(...)`,
// which depends on the host's locale parser and breaks on non-`en-US`
// runtimes — `formatToParts` avoids that fragility.
const ET_PARTS_FORMATTER = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
});

interface EtParts {
    weekdayIndex: number; // 0 = Sunday … 6 = Saturday
    hour: number;
    minute: number;
}

const WEEKDAY_LOOKUP: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
};

/** Normalize hour value from ICU formatter — some locales emit '24' for midnight, but downstream math expects '00'–'23'. */
export function normalizeHour(parsed: number): number {
    return parsed === 24 ? 0 : parsed;
}

/** Look up the weekday index for an ICU `'short'` weekday string. Falls back to 0 (Sunday) for unrecognized values — defensive guard for locale drift. */
export function lookupWeekday(raw: string): number {
    return WEEKDAY_LOOKUP[raw] ?? 0;
}

export function etParts(now: Date): EtParts {
    // `formatToParts` returns ~5-8 items, so reduce+spread cost is negligible.
    // Declarative form preferred over let+for mutation. 'hour12: false' usually
    // emits '00'–'23', but some runtimes (e.g. locales with hourCycle 'h23' such
    // as de-DE on certain ICU versions) emit '24' at midnight as a defensive
    // edge case. `normalizeHour` 추출 이후 24 → 0 정규화 로직은 직접 단위 테스트로
    // 검증된다. V8 en-US 환경에서는 ICU formatter가 항상 '00'–'23'을 emit하므로
    // etParts 안에서 이 분기를 trigger할 수는 없지만, 다른 ICU locale 변화에
    // 대비한 defensive guard로 normalizeHour를 통해 격리·검증한다.
    return ET_PARTS_FORMATTER.formatToParts(now).reduce<EtParts>(
        (acc, part) => {
            if (part.type === 'weekday') {
                return {
                    ...acc,
                    weekdayIndex: lookupWeekday(part.value),
                };
            }
            if (part.type === 'hour') {
                const parsed = Number.parseInt(part.value, 10);
                return { ...acc, hour: normalizeHour(parsed) };
            }
            if (part.type === 'minute') {
                return { ...acc, minute: Number.parseInt(part.value, 10) };
            }
            return acc;
        },
        { weekdayIndex: 0, hour: 0, minute: 0 }
    );
}

export type EtSessionStatus = 'weekend' | 'open' | 'closed';

/** Classify the current ET moment as weekend / regular-session-open / closed-but-weekday. */
export function getEtSessionStatus(now: Date): EtSessionStatus {
    const { weekdayIndex, hour, minute } = etParts(now);
    if (weekdayIndex === 0 || weekdayIndex === 6) return 'weekend';
    const totalMin = hour * MINUTES_PER_HOUR + minute;
    if (totalMin >= MARKET_OPEN_MIN && totalMin <= MARKET_CLOSE_MIN)
        return 'open';
    return 'closed';
}

/**
 * `true` when `now` is inside U.S. equity options regular session
 * (ET Mon–Fri 09:30–16:00). DST-safe — the Intl formatter resolves EDT/EST
 * automatically based on the calendar position of `now`.
 *
 * Pure function — callers must pass an explicit `now` so the domain layer
 * stays deterministic and tests can freeze the clock without mocking.
 */
export function isUsOptionsRegularSession(now: Date): boolean {
    return getEtSessionStatus(now) === 'open';
}

/**
 * 전체 contract 중 OI=0 비율이 이 임계값 이상이면 stale로 판정.
 *
 * 테스트에서 임계값 경계 케이스를 검증할 때 동일한 상수를 import해 사용해야
 * 임계값 조정 시 테스트가 자동으로 따라온다 — 하드코딩 금지.
 */
export const OI_STALE_FRACTION_THRESHOLD = 0.95;

/**
 * Stale-quote 휴리스틱: 옵션 시장이 활성화된 종목인데도 전체 contract의 95%
 * 이상이 OI=0인 경우 Yahoo의 정규장 외 quote 클리어 상태로 판정한다.
 *
 * "100% 모두 0"이 아닌 비율 임계값을 쓰는 이유: Yahoo는 PRE / PRE-PRE /
 * POSTPOST 시간대에 대부분 contract의 quote(OI 포함)를 0/sentinel로
 * 클리어하지만, 일부 deep ITM hedge LEAPS처럼 거래가 거의 없는
 * contract는 마지막 EOD 값을 그대로 보존한다 (실측: PLTR PRE-PRE 1252개 중
 * 12개만 OI > 0). 압도적 다수가 0이면 stale로 본다.
 *
 * 정규장 시간대에는 호출하지 말 것 — 활발히 거래되는 종목은 정규장에도
 * deep OTM strike OI 0이 흔하므로 false positive 위험. 호출자
 * (OptionsPageClient)에서 `isUsOptionsRegularSession`과 AND 조건으로 결합한다.
 */
export function isOpenInterestSnapshotStale(
    snapshot: OptionsSnapshot
): boolean {
    const allContracts = snapshot.chains.flatMap(c => [...c.calls, ...c.puts]);
    if (allContracts.length === 0) return true;
    const zeroCount = allContracts.filter(c => c.openInterest === 0).length;
    return zeroCount / allContracts.length >= OI_STALE_FRACTION_THRESHOLD;
}
