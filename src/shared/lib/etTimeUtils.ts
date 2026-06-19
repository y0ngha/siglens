// EDT: 3월 두 번째 일요일 02:00 ~ 11월 첫 번째 일요일 02:00 → UTC-4 (IANA America/New_York)
// EST: 그 외 구간 → UTC-5
// 월은 JS Date 0-indexed 기준 (0 = January)
import { FIRST_SUNDAY, MARCH, NOVEMBER, SECOND_SUNDAY } from './eastern';

const DAYS_IN_WEEK = 7;
const SPRING_FORWARD_MONTH = MARCH;
const SPRING_FORWARD_NTH = SECOND_SUNDAY;
const FALL_BACK_MONTH = NOVEMBER;
const FALL_BACK_NTH = FIRST_SUNDAY;
const DST_TRANSITION_LOCAL_HOUR = 2;

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

/**
 * `etDateTimeToKst`의 반환 타입.
 *
 * - `iso`         : ET ISO-8601 문자열 — HTML `<time dateTime>` 용도.
 * - `kstDateKey`  : KST 기준 날짜 'YYYY-MM-DD' — 캘린더 그룹핑 키.
 * - `kstTimeLabel`: KST 시각 레이블 '오전/오후 H:mm' (ko-KR, 한국 표준시).
 */
export interface EtToKstResult {
    iso: string;
    kstDateKey: string;
    kstTimeLabel: string;
}

/**
 * ET 벽시계 문자열('YYYY-MM-DD HH:mm:ss')을 KST 캘린더 표시용 정보로 변환한다.
 *
 * 반환값:
 * - `iso`         : ET ISO-8601 문자열 — HTML `<time dateTime>` 용도.
 * - `kstDateKey`  : KST 기준 날짜 'YYYY-MM-DD' — 캘린더 그룹핑 키.
 * - `kstTimeLabel`: KST 시각 레이블 '오전/오후 H:mm' (ko-KR, 한국 표준시).
 *
 * 변환 흐름: ET 로컬 → ISO(ET offset 포함) → `new Date(iso)` → Asia/Seoul Intl 포맷.
 * `new Date(iso)`는 ISO 오프셋을 포함하므로 UTC 기준으로 정확히 파싱된다.
 * 날짜 롤오버(예: ET 오후 → KST 다음날)는 Intl.DateTimeFormat이 자동 처리한다.
 */
export function etDateTimeToKst(etDate: string): EtToKstResult {
    const iso = toIsoDateTime(etDate);
    const d = new Date(iso);

    /**
     * 'YYYY-MM-DD' 형식으로 KST 날짜 키 생성.
     * `formatToParts`로 년/월/일을 개별 추출해 직접 조합한다.
     * `en-CA` 로케일을 직접 format()하면 ICU 버전에 따라 구분자가 '/'로 오거나
     * 순서가 바뀌어 `split('-')`이 NaN을 반환할 수 있다.
     */
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(d);
    const year = parts.find(p => p.type === 'year')?.value ?? '';
    const month = parts.find(p => p.type === 'month')?.value ?? '';
    const day = parts.find(p => p.type === 'day')?.value ?? '';
    const kstDateKey = `${year}-${month}-${day}`;

    const kstTimeLabel = new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    }).format(d);

    return { iso, kstDateKey, kstTimeLabel };
}
