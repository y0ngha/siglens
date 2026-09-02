import { INTL_LOCALE, type Locale } from '@/shared/i18n/locales';
import { MS_PER_DAY } from '@/shared/config/time';
// EDT: 3월 두 번째 일요일 02:00 ~ 11월 첫 번째 일요일 02:00 → UTC-4 (IANA America/New_York)
// EST: 그 외 구간 → UTC-5
// 월은 JS Date 0-indexed 기준 (0 = January)
import {
    FIRST_SUNDAY,
    MARCH,
    NOVEMBER,
    SECOND_SUNDAY,
    nthSundayDay,
} from './eastern';

// nthSundayDay는 eastern.ts의 정규 원시 함수를 위임해 사용한다.
// 하위 호환성을 위해 re-export한다 (기존 import 경로 유지).
export { nthSundayDay };

// Intl 포매터 생성은 비싸다 — 모듈 스코프에 한 번만 만들어 재사용한다.
const KST_DATE_PARTS_FORMATTER = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
});

/**
 * KST 기준 `YYYY-MM-DD`.
 *
 * `en-CA`로 바로 `format()`하면 ICU 버전에 따라 구분자가 `/`가 되거나 순서가
 * 바뀌어 `split('-')`이 NaN을 내놓는다. `formatToParts`로 조각을 뽑아 조립한다.
 *
 * 방문자 집계(`/api/presence`)와 그 클라이언트 비콘이 이 함수를 공유한다 —
 * 둘이 다른 날짜 경계를 쓰면 특정 날의 방문자가 통째로 누락된다.
 */
export function kstDateKey(date: Date): string {
    const parts = KST_DATE_PARTS_FORMATTER.formatToParts(date);
    const year = parts.find(p => p.type === 'year')?.value ?? '';
    const month = parts.find(p => p.type === 'month')?.value ?? '';
    const day = parts.find(p => p.type === 'day')?.value ?? '';
    return `${year}-${month}-${day}`;
}

/** `YYYY-MM-DD`의 길이. 문자열을 자를 때 쓴다. */
const ISO_DATE_LENGTH = 10;

/**
 * KST 날짜 키에서 `days`일을 뺀 KST 날짜 키.
 *
 * 달력 문자열 산술이라 UTC로 파싱한다 — 키에 시각이 없으므로 어느 타임존으로
 * 읽든 같은 날 수만큼 물러난다. 로컬 타임존으로 파싱하면 DST가 있는 지역에서
 * 하루가 밀린다.
 *
 * `/api/presence`의 보존 기간 정리와 `yarn metrics`의 조회 창이 이 함수를
 * 공유한다. 둘이 각자 구현하면 한쪽만 고쳐질 수 있고, 그 어긋남은 방침에
 * 고지한 보존 기간과 실제 삭제 기준이 달라지는 형태로 나타난다.
 */
export function kstDateKeyDaysBefore(dateKey: string, days: number): string {
    const base = new Date(`${dateKey}T00:00:00Z`);
    return new Date(base.getTime() - days * MS_PER_DAY)
        .toISOString()
        .slice(0, ISO_DATE_LENGTH);
}

/**
 * KST 시각 레이블 포맷터 — **로케일별**로 캐시한다.
 *
 * 예전에는 `'ko-KR'` 고정이라 `/en/economy`의 경제 캘린더가 영어 표 안에
 * `오전 8:30`을 찍었다. 타임존은 KST로 고정한 채(레이블에 KST 의미가 붙어 있다)
 * 로케일만 따른다.
 */
const KST_TIME_LABEL_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function kstTimeLabelFormatter(
    locale: Locale,
    hour12: boolean
): Intl.DateTimeFormat {
    const key = `${locale}:${hour12}`;
    const cached = KST_TIME_LABEL_FORMATTERS.get(key);
    if (cached) return cached;
    const formatter = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
        timeZone: 'Asia/Seoul',
        hour: 'numeric',
        minute: '2-digit',
        hour12,
    });
    KST_TIME_LABEL_FORMATTERS.set(key, formatter);
    return formatter;
}

const SPRING_FORWARD_MONTH = MARCH;
const SPRING_FORWARD_NTH = SECOND_SUNDAY;
const FALL_BACK_MONTH = NOVEMBER;
const FALL_BACK_NTH = FIRST_SUNDAY;
const DST_TRANSITION_LOCAL_HOUR = 2;

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
export function etDateTimeToKst(
    etDate: string,
    locale: Locale,
    /**
     * 오전/오후 표기 여부.
     *
     * 캘린더 **월 셀**은 `text-[10px] … truncate` 한 줄이라 오전/오후가 들어갈
     * 폭이 없다. 예전에는 호출부가 정규식으로 오전·오후 접두사를
     * 잘라냈는데, 그건 로케일이 `ko-KR`로 고정돼 있을 때만 동작한다 — 로케일을
     * 따르게 만든 순간 `8:30 AM`·`午前8:30`·`上午8:30`이 그대로 남아 셀을
     * 넘쳤다. 문자열을 깎는 대신 **포맷 단계에서** 끄는 게 맞다.
     */
    hour12 = true
): EtToKstResult {
    const iso = toIsoDateTime(etDate);
    const d = new Date(iso);

    const kstDateKeyValue = kstDateKey(d);

    const kstTimeLabel = kstTimeLabelFormatter(locale, hour12).format(d);

    return { iso, kstDateKey: kstDateKeyValue, kstTimeLabel };
}
