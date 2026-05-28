import {
    MARKET_OPEN_HOUR,
    MARKET_OPEN_MINUTE,
    MARKET_CLOSE_HOUR,
    MARKET_CLOSE_MINUTE,
} from '@y0ngha/siglens-core';

// UTC offset gap from ET to KST: EDT(-4) → KST(+9) = 13h, EST(-5) → KST(+9) = 14h.
const EDT_TO_KST_OFFSET_HOURS = 13;
const EST_TO_KST_OFFSET_HOURS = 14;
const HOURS_PER_DAY = 24;

function pad2(n: number): string {
    return String(n).padStart(2, '0');
}

function formatKstTime(
    etHour: number,
    etMinute: number,
    offsetHours: number
): string {
    const kstHour = (etHour + offsetHours) % HOURS_PER_DAY;
    return `${pad2(kstHour)}:${pad2(etMinute)}`;
}

/** US 옵션 정규장 시간 (ET 기준), 예: "ET 9:30 ~ 16:00". */
export const ET_MARKET_HOURS_DISPLAY = `ET ${MARKET_OPEN_HOUR}:${pad2(
    MARKET_OPEN_MINUTE
)} ~ ${MARKET_CLOSE_HOUR}:${pad2(MARKET_CLOSE_MINUTE)}`;

/** KST 환산 시간 — 서머타임(EDT) 기간. */
export const KST_EDT_HOURS_DISPLAY = `${formatKstTime(
    MARKET_OPEN_HOUR,
    MARKET_OPEN_MINUTE,
    EDT_TO_KST_OFFSET_HOURS
)}~${formatKstTime(
    MARKET_CLOSE_HOUR,
    MARKET_CLOSE_MINUTE,
    EDT_TO_KST_OFFSET_HOURS
)}`;

/** KST 환산 시간 — 표준시(EST) 기간. */
export const KST_EST_HOURS_DISPLAY = `${formatKstTime(
    MARKET_OPEN_HOUR,
    MARKET_OPEN_MINUTE,
    EST_TO_KST_OFFSET_HOURS
)}~${formatKstTime(
    MARKET_CLOSE_HOUR,
    MARKET_CLOSE_MINUTE,
    EST_TO_KST_OFFSET_HOURS
)}`;
