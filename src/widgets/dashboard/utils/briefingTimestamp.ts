/**
 * 브리핑 생성 시각의 파싱·표시 헬퍼.
 */
import { INTL_LOCALE, type Locale } from '@/shared/i18n/locales';

/**
 * 표시 시간대. 서버(Node)와 브라우저의 시간대가 달라 생기는 hydration 불일치를 막으려고
 * 고정한다. 어느 시간대인지는 문구가 "KST"로 밝힌다(`BriefingCard.generatedAt`).
 */
const BRIEFING_TIME_ZONE = 'Asia/Seoul';

const BRIEFING_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
    timeZone: BRIEFING_TIME_ZONE,
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
};

function createFormatter(locale: Locale): Intl.DateTimeFormat {
    return new Intl.DateTimeFormat(INTL_LOCALE[locale], BRIEFING_TIME_OPTIONS);
}

/**
 * 로케일별 포매터. `Record<Locale, …>`라 로케일이 늘면 여기서 컴파일 오류가 난다.
 * 렌더마다 `toLocaleString`으로 포매터를 새로 만들지 않도록 모듈에서 한 번 만든다.
 */
const FORMATTER_BY_LOCALE: Record<Locale, Intl.DateTimeFormat> = {
    ko: createFormatter('ko'),
    en: createFormatter('en'),
    ja: createFormatter('ja'),
    zh: createFormatter('zh'),
};

/**
 * `generatedAt` 문자열을 날짜로 읽는다. peek seed는 생성 시각이 빈 문자열이라
 * `new Date('')`가 Invalid Date가 되므로, 읽을 수 없으면 `null`이다.
 */
export function parseGeneratedAt(generatedAt: string): Date | null {
    if (!generatedAt) return null;
    const date = new Date(generatedAt);
    return Number.isNaN(date.getTime()) ? null : date;
}

/** 로케일에 맞춘 한국 시각 문자열(시간대 이름 없음). */
export function formatBriefingTime(date: Date, locale: Locale): string {
    return FORMATTER_BY_LOCALE[locale].format(date);
}
