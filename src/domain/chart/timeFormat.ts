import type { Timeframe } from '@/domain/types';
import {
    MS_PER_HOUR,
    MS_PER_SECOND,
    KST_OFFSET_HOURS,
} from '@/domain/constants/time';

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

const MINUTE_TIMEFRAMES: ReadonlySet<Timeframe> = new Set([
    '5Min',
    '15Min',
    '30Min',
]);

const HOUR_TIMEFRAMES: ReadonlySet<Timeframe> = new Set(['1Hour', '4Hour']);

export function getTimeFormatter(
    timeframe: Timeframe
): (timestamp: number) => string {
    if (MINUTE_TIMEFRAMES.has(timeframe)) {
        return (timestamp: number) => formatTime(toKstDate(timestamp));
    }

    if (HOUR_TIMEFRAMES.has(timeframe)) {
        return (timestamp: number) => formatDateAndTime(toKstDate(timestamp));
    }

    return (timestamp: number) => formatDate(toKstDate(timestamp));
}
