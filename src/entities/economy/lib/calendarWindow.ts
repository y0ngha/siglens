/**
 * 캘린더 윈도 일수 상수 + ET-zoned 날짜 헬퍼.
 *
 * `economySnapshotCache.isoDate`와 같은 ET formatter 패턴을 쓴다 — 서버가 UTC+0의
 * 00:00~04:59에 "오늘"을 계산할 때 ET 기준 전날로 밀리는 오차를 막는다. 모든 함수는
 * 결정론적(`Intl.DateTimeFormat` + 순수 산술)이라 ISR cold-gen에서 안전하다
 * (`Date.now()`/dynamic API 미사용 — 호출자가 `new Date()` 앵커를 주입).
 *
 * **경계 오차(의도적으로 미수정)**: `economicCalendarRepository`가 이 앵커
 * ('YYYY-MM-DD', ET 달력일)를 `economic_calendar.date_et`(FMP 원본 UTC 벽시계
 * 문자열)와 직접 문자열 비교한다. ET는 UTC보다 4~5시간 느리므로 ET 달력일은
 * UTC 달력일과 같거나 하루 이르다 — 즉 과거 경계(`pastWindowStart`)는 항상
 * 같거나 더 넓게, 미래 경계(`futureWindowEnd`/`ensureEconomicCalendarAction`의
 * `to`)는 최대 하루 좁게 잡힐 수 있다. 윈도가 14~180일로 넓고, 미래 경계는
 * 다음 인제스션(재fetch·재렌더)에서 그 하루가 자동으로 편입되므로 이벤트가
 * 영구히 드롭되거나 중복되지 않는다 — 표시·인제스션용 근사 윈도라 수정하지 않는다.
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
        ET_DATE_FORMAT.formatToParts(instant).flatMap(p =>
            p.type === 'literal' ? [] : [[p.type, p.value]]
        )
        // Intl.DateTimeFormat configured with year/month/day always emits parts of these exact types.
    ) as Record<'year' | 'month' | 'day', string>;
    return `${parts.year}-${parts.month}-${parts.day}`;
}

/** UTC instant → KST-zoned 'YYYY-MM-DD'. */
export function kstDateOf(instant: Date): string {
    const parts = Object.fromEntries(
        KST_DATE_FORMAT.formatToParts(instant).flatMap(p =>
            p.type === 'literal' ? [] : [[p.type, p.value]]
        )
        // Intl.DateTimeFormat configured with year/month/day always emits parts of these exact types.
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
