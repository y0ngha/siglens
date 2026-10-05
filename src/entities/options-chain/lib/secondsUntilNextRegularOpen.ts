import {
    MARKET_OPEN_HOUR,
    MARKET_OPEN_MINUTE,
    isUsTradingDay,
} from '@y0ngha/siglens-core';
import { MS_PER_DAY, MS_PER_SECOND } from '@/shared/config/time';
import { getEasternOffsetHours } from '@/shared/lib/eastern';
import { zonedDate } from '@/shared/lib/marketSessionDate';
import { ET_TIME_ZONE } from './etTimeZone';

const ET_NOON_UTC_HOUR = 12;
// 연휴(주말 + 공휴일 연속)를 덮고도 남는 탐색 상한. 못 찾으면 그만큼을 돌려준다.
const MAX_LOOKAHEAD_DAYS = 10;

/**
 * 다음 미국 정규장 개장(09:30 ET)까지 남은 초. 오늘 개장 전이면 오늘 개장, 이미 지났으면
 * 다음 거래일 개장이다. 주말·휴장일을 건너뛴다.
 *
 * core의 같은 이름 함수(`secondsUntilNextEtRegularOpen`)는 `@internal`이라 공개 export가
 * 아니다. 캐시 TTL 상한 계산에만 쓰이므로 여기서 공개 API(`isUsTradingDay`,
 * `MARKET_OPEN_*`)로 다시 만든다. 개장 시각의 UTC 환산은 그날 정오(UTC)의 ET 오프셋을
 * 쓴다 — DST 전환(02:00 ET)이 09:30 이전에 끝나므로 같은 날 오프셋이 맞다.
 */
export function secondsUntilNextRegularOpen(now: Date): number {
    let date = zonedDate(now, ET_TIME_ZONE);
    for (let i = 0; i <= MAX_LOOKAHEAD_DAYS; i++) {
        const [year, month, day] = date.split('-').map(Number);
        const noon = new Date(Date.UTC(year, month - 1, day, ET_NOON_UTC_HOUR));
        if (isUsTradingDay(noon)) {
            const offset = getEasternOffsetHours(noon);
            const openAt = Date.UTC(
                year,
                month - 1,
                day,
                MARKET_OPEN_HOUR - offset,
                MARKET_OPEN_MINUTE
            );
            if (openAt > now.getTime()) {
                return Math.ceil((openAt - now.getTime()) / MS_PER_SECOND);
            }
        }
        date = new Date(noon.getTime() + MS_PER_DAY).toISOString().slice(0, 10);
    }
    return (MAX_LOOKAHEAD_DAYS * MS_PER_DAY) / MS_PER_SECOND;
}
