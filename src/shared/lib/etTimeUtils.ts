import { INTL_LOCALE, type Locale } from '@/shared/i18n/locales';
import { MS_PER_DAY } from '@/shared/config/time';
import { nthSundayDay } from './eastern';

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

/**
 * FMP `economic-calendar`의 `date`('YYYY-MM-DD HH:mm:ss')를 HTML `<time dateTime>`이
 * 인식하는 ISO-8601 인스턴트로 정규화한다.
 *
 * FMP 원본은 **UTC**다(존 마커 없음, 실측: "2026-09-16 18:00:00 Fed Interest Rate
 * Decision" = FOMC 14:00 EDT = 18:00 UTC). 예전 구현은 이걸 ET 벽시계로 오인해
 * DST 오프셋을 붙였는데, 그러면 UTC 시각에 다시 -4/-5시간이 빠져 항상 4~5시간
 * 어긋난 절대 시각이 나온다. 그냥 `Z`를 붙이면 된다.
 */
export function fmpCalendarDateTimeToIso(date: string): string {
    return `${date.replace(' ', 'T')}Z`;
}

/**
 * `fmpCalendarDateTimeToKst`의 반환 타입.
 *
 * - `iso`         : UTC ISO-8601 문자열 — HTML `<time dateTime>` 용도.
 * - `kstDateKey`  : KST 기준 날짜 'YYYY-MM-DD' — 캘린더 그룹핑 키.
 * - `kstTimeLabel`: KST 시각 레이블 '오전/오후 H:mm' (로케일별, 한국 표준시).
 */
export interface FmpCalendarKstResult {
    iso: string;
    kstDateKey: string;
    kstTimeLabel: string;
}

/**
 * FMP 경제 캘린더의 UTC 벽시계 문자열('YYYY-MM-DD HH:mm:ss')을 KST 캘린더
 * 표시용 정보로 변환한다.
 *
 * 반환값:
 * - `iso`         : UTC ISO-8601 문자열 — HTML `<time dateTime>` 용도.
 * - `kstDateKey`  : KST 기준 날짜 'YYYY-MM-DD' — 캘린더 그룹핑 키.
 * - `kstTimeLabel`: KST 시각 레이블 '오전/오후 H:mm' (로케일별, 한국 표준시).
 *
 * 변환 흐름: UTC 벽시계 → ISO(`Z`) → `new Date(iso)` → Asia/Seoul Intl 포맷.
 * 날짜 롤오버(예: UTC 오후 → KST 다음날)는 Intl.DateTimeFormat이 자동 처리한다.
 */
export function fmpCalendarDateTimeToKst(
    date: string,
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
): FmpCalendarKstResult {
    const iso = fmpCalendarDateTimeToIso(date);
    const d = new Date(iso);

    const kstDateKeyValue = kstDateKey(d);

    const kstTimeLabel = kstTimeLabelFormatter(locale, hour12).format(d);

    return { iso, kstDateKey: kstDateKeyValue, kstTimeLabel };
}
