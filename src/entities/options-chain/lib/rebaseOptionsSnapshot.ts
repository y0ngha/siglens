import {
    REGULAR_CLOSE_MINUTE,
    usMarketCloseMinute,
    type OptionsSnapshot,
} from '@y0ngha/siglens-core';
import { zonedDate } from '@/shared/lib/marketSessionDate';
import { cachedDateTimeFormat } from '@/shared/lib/intlFormatCache';
import { MINUTES_PER_HOUR } from '@/shared/config/time';
import { ET_TIME_ZONE } from './etTimeZone';
import { daysToExpirationFrom } from './yahooNormalize';

/** `now`의 ET 벽시계를 자정 이후 분(分)으로. DST는 IANA 타임존이 처리한다. */
function etMinutesOfDay(now: Date): number {
    const parts = cachedDateTimeFormat('en-US', {
        timeZone: ET_TIME_ZONE,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(now);
    const read = (type: 'hour' | 'minute'): number =>
        Number(parts.find(part => part.type === type)?.value ?? 0);
    return read('hour') * MINUTES_PER_HOUR + read('minute');
}

/** 오늘(ET) 정규장 종가 종소리(조기 마감일은 13:00) 이후인가. 개장 전(프리마켓)은 `false`. */
function isAtOrAfterCloseEt(now: Date): boolean {
    const closeMinute = usMarketCloseMinute(now) || REGULAR_CLOSE_MINUTE;
    return etMinutesOfDay(now) >= closeMinute;
}

/**
 * 며칠 전에 저장해 둔 옵션 스냅샷을 오늘 기준으로 다시 맞춘다.
 *
 * 마지막 정상 스냅샷(last-good)을 다시 내보낼 때만 쓴다. 저장된 값은 수집 시점 기준이라
 * 그대로 내보내면 이미 끝난 만기가 "가장 가까운 만기"로 뽑히고 `daysToExpiration`이
 * 어제 숫자로 남는다. 그래서
 *
 * - 만기가 오늘(ET) **이전**인 만기를 버린다. 오늘 만기는 정규장 종가(16:00 ET, 조기 마감일
 *   13:00) 전까지만 남긴다 — 그 뒤에는 이미 끝난 만기라 "가장 가까운 만기"로 뽑히면 안 된다.
 * - `daysToExpiration`을 Yahoo 정규화와 같은 계산(`daysToExpirationFrom`)으로 다시 센다.
 *
 * `capturedAt`은 **그대로 둔다** — 화면이 "언제 수집한 값인가"를 정직하게 밝히는 근거다.
 * 남은 만기가 하나도 없으면 `null`(되살릴 데이터가 없다).
 */
export function rebaseOptionsSnapshot(
    snapshot: OptionsSnapshot,
    now: Date
): OptionsSnapshot | null {
    const todayEt = zonedDate(now, ET_TIME_ZONE);
    const expiryDayIsOver = isAtOrAfterCloseEt(now);
    const chains = snapshot.chains
        .filter(chain =>
            expiryDayIsOver
                ? chain.expirationDate > todayEt
                : chain.expirationDate >= todayEt
        )
        .map(chain => ({
            ...chain,
            daysToExpiration: daysToExpirationFrom(chain.expirationDate, now),
        }));
    if (chains.length === 0) return null;
    return { ...snapshot, chains };
}
