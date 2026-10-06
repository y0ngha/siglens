import { US_EQUITY_SESSION, isUsTradingDay } from '@y0ngha/siglens-core';
import { MINUTES_PER_HOUR, MS_PER_MINUTE } from '@/shared/config/time';
import { getEasternOffsetHours } from '@/shared/lib/eastern';
import {
    lastClosedSessionCloseUtc,
    zonedDate,
} from '@/shared/lib/marketSessionDate';
import { ET_TIME_ZONE } from './etTimeZone';

/** 정규장 마감 후 Yahoo가 OI를 확정해 내주기까지 기다리는 시간(분). */
export const OPTIONS_WARM_START_BUFFER_MINUTES = 15;

/**
 * 워밍 종료 시각(ET 19:45). Yahoo는 ~20:00 ET부터 OI를 비우므로, 마지막 요청이 그 경계에
 * 걸려 stale을 받지 않도록 15분 여유를 둔다.
 */
export const OPTIONS_WARM_END_ET_MINUTES = 19 * MINUTES_PER_HOUR + 45;

export interface OptionsWarmWindow {
    /** 오늘 정규장 마감 순간(반장이면 13:00 ET). last-good "이미 확보됨" 판정의 기준. */
    closeUtc: Date;
    /** 워밍 종료 순간(오늘 19:45 ET). */
    endUtc: Date;
}

/**
 * 지금이 옵션 last-good 워밍 구간이면 구간 경계를, 아니면 `null`을 돌려준다.
 *
 * 구간: **미국 거래일**의 `정규장 마감 + 15분` ~ `19:45 ET`. 마감 시각은 core의 규칙
 * 캘린더(`US_EQUITY_SESSION.closeMinuteFor`)가 정하므로 반장(13:00)·휴장일·DST를 이
 * 파일이 따로 알 필요가 없다 — 19:45 ET의 UTC 환산만 `getEasternOffsetHours`로 한다
 * (DST 전환은 02:00 ET라 같은 날 저녁에는 오프셋이 하나다).
 *
 * `lastClosedSessionCloseUtc(.., 15)`가 "마감+15분이 지난 가장 최근 세션"을 주므로, 그
 * 세션이 **오늘(ET)**이면 오늘 마감+15분이 이미 지났다는 뜻이다. 오늘이 거래일이 아니거나
 * 아직 마감+15분 전이면 직전 거래일이 나와 날짜가 달라 거부된다.
 */
export function getOptionsWarmWindow(now: Date): OptionsWarmWindow | null {
    if (!isUsTradingDay(now)) return null;

    const todayEt = zonedDate(now, ET_TIME_ZONE);
    const closeUtc = lastClosedSessionCloseUtc(
        US_EQUITY_SESSION,
        now,
        OPTIONS_WARM_START_BUFFER_MINUTES
    );
    if (zonedDate(closeUtc, ET_TIME_ZONE) !== todayEt) return null;

    const startMs =
        closeUtc.getTime() + OPTIONS_WARM_START_BUFFER_MINUTES * MS_PER_MINUTE;
    const [year, month, day] = todayEt.split('-').map(Number);
    const endMs =
        Date.UTC(year, month - 1, day) +
        (OPTIONS_WARM_END_ET_MINUTES -
            getEasternOffsetHours(now) * MINUTES_PER_HOUR) *
            MS_PER_MINUTE;

    const nowMs = now.getTime();
    if (nowMs < startMs || nowMs > endMs) return null;
    return { closeUtc, endUtc: new Date(endMs) };
}
