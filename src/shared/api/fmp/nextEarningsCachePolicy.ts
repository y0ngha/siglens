import {
    ISO_DATE_LENGTH,
    MS_PER_DAY,
    SECONDS_PER_HOUR,
    SECONDS_PER_QUARTER_DAY,
} from '@/shared/config/time';
import type { EarningsReport } from '@y0ngha/siglens-core';

/*
 * `getEarningsReport`(다음 실적 일정 1건) Redis 캐시의 신선도·TTL 규칙 — 이 파일 전체의 정책.
 * 아래 두 함수가 이 규칙을 구현한다(읽기 판정 / 쓰기 TTL).
 *
 * 이 값은 core 펀더멘털 분석이 `nextEarningsAt`으로 프롬프트에 넣는다. 캐시 때문에 **이미 지난
 * 실적일**이나 **바뀐 일정**을 오래 쓰면 안 된다. 그래서:
 *
 * - 캐시된 실적일이 오늘(UTC)보다 이전이면 절대 쓰지 않는다(`isNextEarningsCacheFresh` false →
 *   다시 받는다). 방금 받은 값 자체가 지난 날짜라면(FMP가 다음 분기 일정을 아직 안 냈다) 예전
 *   캐시 없는 동작과 같은 값이라 그대로 돌려주되 저장하지 않는다 — 다음 호출이 다시 받아 다음
 *   분기 일정이 올라오는 즉시 보인다(그 구간의 호출 수는 예전과 같다).
 * - 실적일이 하루 안으로 가까우면(오늘·내일) 1시간만 둔다 — 발표 당일 FMP가 다음 분기
 *   일정을 추가하는 시점을 놓치지 않기 위해서다.
 * - 일정이 없으면(`null`, ETF·미정) 1시간 둔다.
 * - 그 밖에는 6시간 둔다.
 *
 * **감수하는 지연(캐시 없는 예전 동작과의 차이):** 회사가 앞으로의 실적일을 옮기면 최대 6시간,
 * 일정이 없다가 새로 잡히면 최대 1시간 늦게 반영된다. 실적일 변경은 보통 며칠~몇 주 앞서
 * 공지되고, 같은 데이터를 쓰는 뉴스 탭·챗의 DB 경로는 이미 하루 신선도로 돌고 있어 그보다 짧다.
 *
 * "오늘"은 UTC 날짜다. 미국 실적일(ET)과 최대 하루 어긋날 수 있지만, 그 경계 구간은 위의
 * "하루 안" 규칙이 1시간 TTL로 덮는다.
 */
// 두 값은 지금 같지만(1시간) 이유가 달라 따로 둔다 — 실적일 직전·당일은 FMP가 다음 분기 일정을
// 추가하는 시점을 놓치지 않으려는 것이고, 일정 없음은 새로 잡힌 일정을 늦게 보지 않으려는 것이다.
// 한쪽만 조정할 일이 생기면 서로 끌려가지 않는다.
const NEAR_EARNINGS_TTL_SECONDS = SECONDS_PER_HOUR;
const NO_SCHEDULE_TTL_SECONDS = SECONDS_PER_HOUR;
const DEFAULT_TTL_SECONDS = SECONDS_PER_QUARTER_DAY;
const NEAR_EARNINGS_WINDOW_DAYS = 1;

function daysFromToday(earningsDate: string, today: string): number {
    return Math.round(
        (Date.parse(`${earningsDate.slice(0, ISO_DATE_LENGTH)}T00:00:00Z`) -
            Date.parse(`${today}T00:00:00Z`)) /
            MS_PER_DAY
    );
}

/**
 * 캐시된 값을 그대로 써도 되는가. 지난 실적일(오늘 UTC보다 이전)은 쓰지 않고 다시 받는다.
 * 같은 판정을 쓰기 쪽 `shouldCache`에도 써서, 받은 값이 지난 날짜면 저장하지 않는다.
 */
export function isNextEarningsCacheFresh(
    report: EarningsReport | null,
    today: string
): boolean {
    return report === null || daysFromToday(report.earningsDate, today) >= 0;
}

/**
 * 방금 받은 값의 TTL(초): 일정 없음(null) 1시간, 실적일이 오늘·내일이면 1시간, 그 외 6시간.
 * 근거와 감수하는 지연은 파일 상단 주석 참고.
 */
export function nextEarningsTtlSeconds(
    report: EarningsReport | null,
    today: string
): number {
    if (report === null) return NO_SCHEDULE_TTL_SECONDS;
    // 지난 실적일(음수)도 이 분기로 1시간이 된다. 호출부는 지난 실적일을 `shouldCache`로 먼저
    // 걸러 저장하지 않으므로 실제로는 닿지 않는다 — 그 가드가 빠져도 오래 남지 않게 하는 방어다.
    return daysFromToday(report.earningsDate, today) <=
        NEAR_EARNINGS_WINDOW_DAYS
        ? NEAR_EARNINGS_TTL_SECONDS
        : DEFAULT_TTL_SECONDS;
}
