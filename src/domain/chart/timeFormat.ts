import type { Timeframe } from '@/domain/types';

const SECONDS_TO_MS = 1000;
const SECONDS_PER_HOUR = 3600;
const KST_OFFSET_MS = 9 * SECONDS_PER_HOUR * SECONDS_TO_MS;

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
    return new Date(timestampSeconds * SECONDS_TO_MS + KST_OFFSET_MS);
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
        return (timestamp: number) => formatTime(toKstDate(timestamp));
    }
    if (timeframe === '1Hour') {
        return (timestamp: number) => formatDateAndTime(toKstDate(timestamp));
    }
    return (timestamp: number) => formatDate(toKstDate(timestamp));
}
