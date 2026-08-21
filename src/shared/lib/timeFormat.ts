import { INTL_LOCALE, type Locale } from '@/shared/i18n/locales';
import type { Timeframe } from '@y0ngha/siglens-core';
import {
    KST_OFFSET_HOURS,
    MS_PER_HOUR,
    MS_PER_SECOND,
} from '@/shared/config/time';

/**
 * 차트 축·크로스헤어의 월 약칭.
 *
 * 예전에는 `['Jan','Feb',…]` 영어 상수였다 — ko를 포함한 네 로케일 전부
 * 영어였고, 정작 차트 축은 `lightweight-charts`가 `navigator.language`로
 * 그려서 `/en/AAPL`이 `4월 5월`을 찍었다(브라우저가 ko-KR일 때). 축과
 * 크로스헤어가 같은 로케일을 쓰도록 둘 다 URL 로케일에 맞춘다.
 */
const MONTH_DAY_CACHE = new Map<Locale, Intl.DateTimeFormat>();

function monthDayFormatter(locale: Locale): Intl.DateTimeFormat {
    const cached = MONTH_DAY_CACHE.get(locale);
    if (cached) return cached;
    const fmt = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
    });
    MONTH_DAY_CACHE.set(locale, fmt);
    return fmt;
}

function toKstDate(timestampSeconds: number): Date {
    const utcDate = new Date(timestampSeconds * MS_PER_SECOND);
    return new Date(utcDate.getTime() + KST_OFFSET_HOURS * MS_PER_HOUR);
}

function padZero(n: number): string {
    return n < 10 ? `0${n}` : `${n}`;
}

function formatTime(date: Date): string {
    const hours = padZero(date.getUTCHours());
    const minutes = padZero(date.getUTCMinutes());
    return `${hours}:${minutes}`;
}

function formatDateAndTime(date: Date): string {
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const time = formatTime(date);
    return `${month}/${day} ${time}`;
}

function formatDate(date: Date, locale: Locale): string {
    // 월+일을 통째로 `Intl`에 맡긴다 — 월 이름만 번역하면 ko가 `8월 1`처럼
    // `일`이 빠진 어색한 표기가 된다. 로케일마다 순서·구분자가 다르다.
    return monthDayFormatter(locale).format(date);
}

const MINUTE_TIMEFRAMES: ReadonlySet<Timeframe> = new Set(['5Min']);

// 15Min/30Min은 조회 기간이 20-30일이므로 날짜+시간 형식 표시
const DATE_TIME_TIMEFRAMES: ReadonlySet<Timeframe> = new Set([
    '15Min',
    '30Min',
    '1Hour',
    '4Hour',
]);

/**
 * 로케일별 포맷터 캐시.
 *
 * 예전에는 `'ko-KR'` 고정 상수 하나였다 — 그래서 `/en/AAPL/news`가
 * `Latest articles are based on 2026년 8월 20일 오전 02:39 KST.`처럼
 * **영어 문장 안에 한국어 타임스탬프**를 박았다. 문장 템플릿만 번역하고
 * 값은 고정 로케일로 두면 통째로 한국어일 때보다 더 나쁘게 읽힌다.
 *
 * 타임존은 KST로 유지한다 — 뒤에 `KST`를 명시해 붙이므로 로케일과 무관하다.
 */
const NEWS_FORMATTER_CACHE = new Map<Locale, Intl.DateTimeFormat>();

function newsFormatterFor(locale: Locale): Intl.DateTimeFormat {
    const cached = NEWS_FORMATTER_CACHE.get(locale);
    if (cached) return cached;
    const formatter = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Seoul',
    });
    NEWS_FORMATTER_CACHE.set(locale, formatter);
    return formatter;
}

/**
 * ISO 발행 시각을 KST 기준 한국어 날짜+시간 문자열로 변환한다.
 *
 * 두 뉴스 서피스(NewsList · MarketNewsCard)가 동일한 포맷터 인스턴스를
 * 공유할 수 있도록 shared/lib에 단일 소스로 배치됐다.
 *
 * @example
 * formatNewsPublishedAt('2026-05-05T22:35:21.000Z')
 * // → '2026년 5월 6일 오전 07:35 KST'
 */
export function formatNewsPublishedAt(
    publishedAt: string,
    locale: Locale
): string {
    return `${newsFormatterFor(locale).format(new Date(publishedAt))} KST`;
}

export function getTimeFormatter(
    timeframe: Timeframe,
    locale: Locale
): (timestamp: number) => string {
    if (MINUTE_TIMEFRAMES.has(timeframe)) {
        return (timestamp: number) => formatTime(toKstDate(timestamp));
    }

    if (DATE_TIME_TIMEFRAMES.has(timeframe)) {
        return (timestamp: number) => formatDateAndTime(toKstDate(timestamp));
    }

    return (timestamp: number) => formatDate(toKstDate(timestamp), locale);
}
