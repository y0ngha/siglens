/**
 * 캘린더 윈도 일수 상수 + ET-zoned 날짜 헬퍼.
 *
 * `economySnapshotCache.isoDate`와 같은 ET formatter 패턴을 쓴다 — 서버가 UTC+0의
 * 00:00~04:59에 "오늘"을 계산할 때 ET 기준 전날로 밀리는 오차를 막는다. 모든 함수는
 * 결정론적(`Intl.DateTimeFormat` + 순수 산술)이라 ISR cold-gen에서 안전하다
 * (`Date.now()`/dynamic API 미사용 — 호출자가 `new Date()` 앵커를 주입).
 */

/** 과거 윈도 일수 — 최소 2주(spec). */
export const PAST_WINDOW_DAYS = 14;

/** 미래 윈도 일수 — #610 그리드의 다가오는 ~2주와 정렬. */
export const FUTURE_WINDOW_DAYS = 14;

const ET_DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'America/New_York',
});

const KST_DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Seoul',
});

/** UTC instant → ET-zoned 'YYYY-MM-DD'. */
export function etDateOf(instant: Date): string {
    const parts = Object.fromEntries(
        ET_DATE_FORMAT.formatToParts(instant)
            .filter(p => p.type !== 'literal')
            .map(p => [p.type, p.value])
    ) as Record<'year' | 'month' | 'day', string>;
    return `${parts.year}-${parts.month}-${parts.day}`;
}

/** UTC instant → KST-zoned 'YYYY-MM-DD'. */
export function kstDateOf(instant: Date): string {
    const parts = Object.fromEntries(
        KST_DATE_FORMAT.formatToParts(instant)
            .filter(p => p.type !== 'literal')
            .map(p => [p.type, p.value])
    ) as Record<'year' | 'month' | 'day', string>;
    return `${parts.year}-${parts.month}-${parts.day}`;
}

/** 'YYYY-MM-DD'에 일수를 더한 'YYYY-MM-DD' (UTC 산술 — TZ 비의존). */
export function addEtDays(dateEt: string, delta: number): string {
    const [y, m, d] = dateEt.split('-').map(Number);
    const shifted = new Date(Date.UTC(y, m - 1, d + delta));
    const yy = shifted.getUTCFullYear();
    const mm = String(shifted.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(shifted.getUTCDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
}

/** 앵커일(포함) 기준 과거 윈도 시작일. */
export function pastWindowStart(anchorEt: string): string {
    return addEtDays(anchorEt, -PAST_WINDOW_DAYS);
}

/** 앵커일(포함) 기준 미래 윈도 종료일. */
export function futureWindowEnd(anchorEt: string): string {
    return addEtDays(anchorEt, FUTURE_WINDOW_DAYS);
}
