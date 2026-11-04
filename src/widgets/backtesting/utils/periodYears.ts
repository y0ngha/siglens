const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

/** ISO 날짜 두 개 사이의 기간을 가장 가까운 정수 연수로(최소 1). 히어로 제목의 "N년" 인자. */
export function periodYears(startIso: string, endIso: string): number {
    const ms =
        Date.parse(`${endIso}T00:00:00Z`) - Date.parse(`${startIso}T00:00:00Z`);
    return Number.isFinite(ms) ? Math.max(1, Math.round(ms / MS_PER_YEAR)) : 1;
}
