// EDT: 3월 두 번째 일요일 02:00 ~ 11월 첫 번째 일요일 02:00 → UTC-4 (IANA America/New_York)
// EST: 그 외 구간 → UTC-5
// 월은 JS Date 0-indexed 기준 (0 = January)
export const DAYS_IN_WEEK = 7;
export const SPRING_FORWARD_MONTH = 2;
export const SPRING_FORWARD_NTH = 2;
export const FALL_BACK_MONTH = 10;
export const FALL_BACK_NTH = 1;
export const DST_TRANSITION_LOCAL_HOUR = 2;

/**
 * 해당 연도·월의 N번째 일요일의 날짜(day-of-month)를 반환한다.
 * @param year - 연도
 * @param month - 0-indexed 월 (0 = January)
 * @param nth - 1-indexed 번째 일요일
 */
export function nthSundayDay(year: number, month: number, nth: number): number {
    const firstDayOfMonth = new Date(Date.UTC(year, month, 1));
    const firstSundayOffset =
        (DAYS_IN_WEEK - firstDayOfMonth.getUTCDay()) % DAYS_IN_WEEK;
    return 1 + firstSundayOffset + (nth - 1) * DAYS_IN_WEEK;
}

/**
 * ET 로컬 벽시계 날짜·시각을 직접 받아 해당 시점의 ET UTC 오프셋을 반환한다.
 *
 * DST 전환 규칙(IANA America/New_York):
 * - Spring forward: 3월 두 번째 일요일 02:00 EST → 03:00 EDT (EST→EDT, UTC-5→UTC-4)
 * - Fall back:     11월 첫 번째 일요일 02:00 EDT → 01:00 EST (EDT→EST, UTC-4→UTC-5)
 *
 * 경계 처리:
 * - Spring 당일 00:00~01:59 → EST(-05:00); 02:00 이후 → EDT(-04:00)
 *   (02:00-02:59는 실제로 존재하지 않지만 EDT로 처리)
 * - Fall 당일 00:00~01:59 → EDT(-04:00); 02:00 이후 → EST(-05:00)
 *   (01:00-01:59는 중복 구간이지만 첫 발생=EDT로 처리)
 *
 * UTC 날짜 기반 Date 객체가 아닌 ET 로컬 컴포넌트로 직접 비교해
 * UTC→ET 변환 시 발생하는 오프셋 불일치 버그를 방지한다.
 */
export function getEtOffset(
    year: number,
    month: number,
    day: number,
    hour: number
): '-04:00' | '-05:00' {
    const springDay = nthSundayDay(
        year,
        SPRING_FORWARD_MONTH,
        SPRING_FORWARD_NTH
    );
    const fallDay = nthSundayDay(year, FALL_BACK_MONTH, FALL_BACK_NTH);

    // Before March or after November → EST
    if (month < SPRING_FORWARD_MONTH || month > FALL_BACK_MONTH)
        return '-05:00';

    if (month === SPRING_FORWARD_MONTH) {
        if (day < springDay) return '-05:00';
        if (day === springDay && hour < DST_TRANSITION_LOCAL_HOUR)
            return '-05:00';
        return '-04:00';
    }

    if (month === FALL_BACK_MONTH) {
        if (day < fallDay) return '-04:00';
        if (day === fallDay && hour < DST_TRANSITION_LOCAL_HOUR)
            return '-04:00';
        return '-05:00';
    }

    // April through October → EDT
    return '-04:00';
}

/**
 * FMP가 보내는 'YYYY-MM-DD HH:mm:ss'를 HTML `<time dateTime>`이 인식하는 ISO-8601
 * 형식으로 정규화한다. FMP 원본은 ET 기준 시각이므로 DST를 고려한 ET offset을 부여해
 * 크롤러·screen reader가 정확한 절대 시각을 파싱할 수 있게 한다.
 *
 * ET 로컬 컴포넌트를 직접 파싱해 `getEtOffset`에 전달한다 — `new Date(... + 'Z')`
 * 경유 시 UTC 변환 오차로 DST 경계가 1시간 어긋나는 버그를 방지한다.
 */
export function toIsoDateTime(date: string): string {
    const [datePart, timePart] = date.split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    const hour = Number(timePart.split(':')[0]);
    const offset = getEtOffset(year, month - 1, day, hour);
    return `${date.replace(' ', 'T')}${offset}`;
}

const NUMBER_FORMATTER = new Intl.NumberFormat('ko-KR');

/** 숫자·단위를 조합한 표기 문자열 반환. null이면 'N/A'. */
export function formatNum(v: number | null, unit: string): string {
    if (v === null) return 'N/A';
    return `${NUMBER_FORMATTER.format(v)}${unit}`;
}
