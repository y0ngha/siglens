import type { Timeframe } from '@/domain/types';
import { getEasternOffsetHours } from '@/domain/time/eastern';

const SECONDS_TO_MS = 1000;
const SECONDS_PER_HOUR = 3600;

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

function toEtDate(timestampSeconds: number): Date {
    const utcDate = new Date(timestampSeconds * SECONDS_TO_MS);
    const etOffsetMs =
        getEasternOffsetHours(utcDate) * SECONDS_PER_HOUR * SECONDS_TO_MS;
    return new Date(utcDate.getTime() + etOffsetMs);
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
    '1Min',
    '5Min',
    '15Min',
]);

export function getTimeFormatter(
    timeframe: Timeframe
): (timestamp: number) => string {
    if (MINUTE_TIMEFRAMES.has(timeframe)) {
        return (timestamp: number) => formatTime(toEtDate(timestamp));
    }
    if (timeframe === '1Hour') {
        return (timestamp: number) => formatDateAndTime(toEtDate(timestamp));
    }
    return (timestamp: number) => formatDate(toEtDate(timestamp));
}
