import { INTL_LOCALE, type Locale } from '@/shared/i18n/locales';

/**
 * ISO 타임스탬프를 KST 기준 날짜+시간 표기로 변환한다. **로케일별**로 표기가 갈린다.
 *
 * - ko: `YYYY년 M월 D일 H시 mm분` (월/일/시는 leading-zero 없음, 분만 2자리 zero-pad).
 *   `Intl.DateTimeFormat('ko-KR')`의 숫자 포맷은 Node/ICU 버전에 따라 리터럴 포함
 *   여부·파트 경계가 달라질 수 있어, 각 숫자 파트만 추출해 직접 조합한다(ko 전용
 *   방어 로직 — 다른 로케일에서는 재현되지 않아 아래 formatToParts 우회는 ko에만 남긴다).
 * - en/ja/zh: 각 로케일 네이티브 `Intl.DateTimeFormat` 출력을 그대로 쓴다.
 *   예전에는 `'ko-KR'` 고정이라 `/en/economy`·`/en/share/[id]`가 영어 문장 안에
 *   `2026년 8월 20일 9시 29분`을 박았다.
 * - timeZone은 로케일과 무관하게 Asia/Seoul로 고정한다 — 서버/클라이언트 렌더
 *   결과가 항상 같다(hydration 불일치 없음). 클라이언트 컴포넌트에서도 안전하다.
 * - 잘못된 ISO 입력은 빈 문자열 대신 원본 문자열을 그대로 반환한다 (graceful fallback).
 *
 * @example
 * formatKoreanDateTime('2026-06-30T14:47:00.000Z', 'ko')
 * // → '2026년 6월 30일 23시 47분'  (KST = UTC+9)
 */
const KST_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
});

const LOCALE_DATE_TIME_FORMATTER_CACHE = new Map<Locale, Intl.DateTimeFormat>();

function localeFormatterFor(locale: Locale): Intl.DateTimeFormat {
    const cached = LOCALE_DATE_TIME_FORMATTER_CACHE.get(locale);
    if (cached) return cached;
    const formatter = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
    LOCALE_DATE_TIME_FORMATTER_CACHE.set(locale, formatter);
    return formatter;
}

function formatKoreanDateTimeKo(date: Date): string {
    // Intl.DateTimeFormat('ko-KR') 숫자 포맷은 Node/ICU 버전에 따라
    // '2026년 6월 30일' 같은 리터럴을 포함하거나 파트 경계가 달라질 수 있다.
    // 안전하게 각 숫자 파트만 추출해 직접 조합한다.
    const parts = KST_DATE_TIME_FORMATTER.formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes): string =>
        parts.find(p => p.type === type)?.value ?? '';

    // 일부 Node/ICU 버전은 hour12:false 에서 자정에 '24'를 반환한다.
    const rawHour = get('hour');
    const hour = rawHour === '24' ? '0' : rawHour;
    const minute = get('minute');

    // 이 분기는 **ko 전용**이다(`formatKoreanDateTime`이 비-ko는 `Intl`로
    // 넘긴다). 여기 한국어는 번역 대상이 아니라 ko 출력 그 자체다.
    return `${get('year')}년 ${get('month')}월 ${get('day')}일 ${hour}시 ${minute}분`;
}

export function formatKoreanDateTime(iso: string, locale: Locale): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
        return iso;
    }

    if (locale !== 'ko') {
        return localeFormatterFor(locale).format(date);
    }

    return formatKoreanDateTimeKo(date);
}
