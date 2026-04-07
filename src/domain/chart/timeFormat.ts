import type { Timeframe } from '@/domain/types';
import { MS_PER_HOUR, MS_PER_SECOND } from '@/domain/constants/time';

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

const KST_OFFSET_HOURS = 9;

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

// TODO: 비용 문제로 인해 우선 1Day만 허용; 미사용이어도 이를 정리하지 않고 넘어간다. 나중에 사용할 예정이다.
function _formatDateAndTime(date: Date): string {
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

// TODO: 비용 문제로 인해 우선 1Day만 허용; 미사용이어도 이를 정리하지 않고 넘어간다. 나중에 사용할 예정이다.
// const MINUTE_TIMEFRAMES: ReadonlySet<Timeframe> = new Set([
//     '1Min',
//     '5Min',
//     '15Min',
// ]);

// TODO: 비용 문제로 인해 우선 1Day만 허용; 미사용이어도 이를 정리하지 않고 넘어간다. 나중에 사용할 예정이다.
export function getTimeFormatter(
    // TODO: 비용 문제로 인해 우선 1Day만 허용; 미사용이어도 이를 정리하지 않고 넘어간다. 나중에 사용할 예정이다.
    _timeframe: Timeframe
): (timestamp: number) => string {
    // TODO: 비용 문제로 인해 우선 1Day만 허용; 미사용이어도 이를 정리하지 않고 넘어간다. 나중에 사용할 예정이다.
    // if (MINUTE_TIMEFRAMES.has(timeframe)) {
    //     return (timestamp: number) => formatTime(toKstDate(timestamp));
    // }
    // if (timeframe === '1Hour') {
    //     return (timestamp: number) => formatDateAndTime(toKstDate(timestamp));
    // }
    return (timestamp: number) => formatDate(toKstDate(timestamp));
}
