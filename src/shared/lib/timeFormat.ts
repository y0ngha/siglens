import type { Timeframe } from '@y0ngha/siglens-core';
import {
    KST_OFFSET_HOURS,
    MS_PER_HOUR,
    MS_PER_SECOND,
} from '@/shared/config/time';

const MONTH_NAMES = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
] as const;

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

function formatDate(date: Date): string {
    const month = MONTH_NAMES[date.getUTCMonth()];
    const day = date.getUTCDate();
    return `${month} ${day}`;
}

const MINUTE_TIMEFRAMES: ReadonlySet<Timeframe> = new Set(['5Min']);

// 15Min/30Min은 조회 기간이 20-30일이므로 날짜+시간 형식 표시
const DATE_TIME_TIMEFRAMES: ReadonlySet<Timeframe> = new Set([
    '15Min',
    '30Min',
    '1Hour',
    '4Hour',
]);

const NEWS_PUBLISHED_AT_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Seoul',
});

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
export function formatNewsPublishedAt(publishedAt: string): string {
    return `${NEWS_PUBLISHED_AT_FORMATTER.format(new Date(publishedAt))} KST`;
}

export function getTimeFormatter(
    timeframe: Timeframe
): (timestamp: number) => string {
    if (MINUTE_TIMEFRAMES.has(timeframe)) {
        return (timestamp: number) => formatTime(toKstDate(timestamp));
    }

    if (DATE_TIME_TIMEFRAMES.has(timeframe)) {
        return (timestamp: number) => formatDateAndTime(toKstDate(timestamp));
    }

    return (timestamp: number) => formatDate(toKstDate(timestamp));
}
