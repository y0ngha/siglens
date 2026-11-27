import { SIGNAL_SETTLE_MINUTES } from '@/entities/signal-history/lib/signalEventRows';
import { sessionSpecForDashboardScope } from '@/shared/api/market/sessionSpecFor';
import type { PriceAlertAsOfRecord } from '@/shared/db/types';
import { lastClosedSessionDate } from '@/shared/lib/marketSessionDate';

/** 시장별 "이 시각의 알림 실행이 마지막으로 판정하는 마감 세션"(`YYYY-MM-DD`). {@link priceAlertAsOf}가 만든다. */
export type PriceAlertAsOf = Readonly<PriceAlertAsOfRecord>;

/**
 * 시장별로 이 시각의 알림 실행이 마지막으로 판정하는 마감 세션을 구한다.
 *
 * 가격대 알림의 만료일(`expiresOn`)은 **마지막으로 종가를 판정하는 세션**이다. 그래서 알림은 만료일이 이 값
 * 이상인 동안(그 세션을 판정하는 실행까지) 살아 있고, 그 실행이 지나야 정리 대상이 된다. 발송 대상 읽기, 정리,
 * 판정 구간, 설정 화면의 목록, 개수 상한이 모두 이 한 정의를 쓴다 — 한국 날짜(알림 날짜)와 비교하면 만료 세션을
 * 판정하기 전에 알림이 사라진다. 신호 기록기와 같은 정착 시간(`SIGNAL_SETTLE_MINUTES`)을 쓰므로 알림 메일의 기대
 * 세션(`expectedSessions`)과 같은 값이다.
 *
 * @param now - 기준 시각.
 * @returns 시장(`us`, `kr`)마다 마지막으로 마감하고 정착 시간이 지난 세션의 현지 날짜.
 */
export function priceAlertAsOf(now: Date): PriceAlertAsOf {
    return {
        us: lastClosedSessionDate(
            sessionSpecForDashboardScope('us'),
            now,
            SIGNAL_SETTLE_MINUTES.us
        ),
        kr: lastClosedSessionDate(
            sessionSpecForDashboardScope('kr'),
            now,
            SIGNAL_SETTLE_MINUTES.kr
        ),
    };
}

/** 알림이 아직 판정 대상인지: 만료 세션이 그 시장의 기대 세션 이상이다. */
export function isPriceAlertLive(
    alert: { readonly market: 'us' | 'kr'; readonly expiresOn: string },
    asOf: PriceAlertAsOf
): boolean {
    return alert.expiresOn >= asOf[alert.market];
}
