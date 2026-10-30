/**
 * 캘린더 표시 문구 — 로케일 요일·월 이름(Intl, 로케일별 캐시)과 이벤트 표시명 해석.
 */
import { INTL_LOCALE, type Locale } from '@/shared/i18n/locales';
import { dayOfWeekFromKey } from './calendarDateKeys';

const WEEKDAY_LABEL_CACHE = new Map<Locale, readonly string[]>();
const MONTH_LABEL_CACHE = new Map<string, string>();

/**
 * 7열 그리드 요일 헤더(일요일 시작). 캡션·헤더와 같은 `Intl.DateTimeFormat` 경로로 파생해
 * 요일 줄만 다른 언어로 남지 않게 한다. 기준일 2000-01-02는 일요일이다.
 */
export function weekdayLabels(locale: Locale): readonly string[] {
    const cached = WEEKDAY_LABEL_CACHE.get(locale);
    if (cached !== undefined) return cached;
    const fmt = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
        weekday: 'short',
        timeZone: 'UTC',
    });
    const labels = Array.from({ length: 7 }, (_, i) =>
        fmt.format(new Date(Date.UTC(2000, 0, 2 + i)))
    );
    WEEKDAY_LABEL_CACHE.set(locale, labels);
    return labels;
}

/**
 * 로케일 월 이름(0-idx). 카탈로그 키 12개 대신 `Intl`에서 얻는다 — 번역된 템플릿에
 * 다른 언어 월 이름이 끼지 않게.
 */
export function monthLabel(locale: Locale, month: number): string {
    const key = `${locale}:${month}`;
    const cached = MONTH_LABEL_CACHE.get(key);
    if (cached !== undefined) return cached;
    const label = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
        month: 'long',
        timeZone: 'UTC',
    }).format(new Date(Date.UTC(2000, month, 1)));
    MONTH_LABEL_CACHE.set(key, label);
    return label;
}

/** 'YYYY-MM-DD'의 로케일 요일 레이블. */
export function kstDayOfWeekLabel(dateKey: string, locale: Locale): string {
    return weekdayLabels(locale)[dayOfWeekFromKey(dateKey)]!;
}

/**
 * 원문 이벤트명 → 표시 레이블. `Object.hasOwn`으로 직접 속성만 본다 — `'toString'` 같은
 * 이름이 Object.prototype 함수를 돌려주는 크래시를 막는다.
 */
export function displayEventLabel(
    rawEvent: string,
    labels: Record<string, string>
): string {
    return Object.hasOwn(labels, rawEvent) ? labels[rawEvent] : rawEvent;
}
