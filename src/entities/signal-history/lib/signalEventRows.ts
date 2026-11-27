import type { MarketSessionSpec } from '@y0ngha/siglens-core';
import {
    lastClosedSessionDate,
    previousSessionDate,
    zonedDate,
} from '@/shared/lib/marketSessionDate';
import type { SignalHistoryMarket } from '../types';

/**
 * 마감 뒤 이만큼 지나야 기록한다(분). 미국은 마지막 봉이 확정될 여유 15분. 한국은 시세가 20분
 * 늦게 오므로(`marketProfile` 실측 KRX 20분) 그만큼 더 기다린다 — 그 전에 계산하면 동시호가
 * 마감가가 빠진 봉으로 신호를 판정한다. 기록기와 알림 발송기가 같은 값으로 "기대 세션"을 구한다.
 */
export const SIGNAL_SETTLE_MINUTES: Readonly<
    Record<SignalHistoryMarket, number>
> = {
    us: 15,
    kr: 35,
};

/**
 * 지금이 `market` 세션을 기록할 때인가 — 그렇다면 그 세션 날짜, 아니면 `null`.
 *
 * 조건: 지금 시각이 **그 시장의 마지막 세션이 마감 + `settleMinutes` 지난 뒤이고, 같은 현지 날짜**일 것.
 * - 장중·마감 직후(정착 전): 마지막 봉이 아직 움직인다 → `null`.
 * - 현지 자정을 넘긴 뒤: 그 세션은 앞 실행이 남겼고, 다음 세션의 장전 값과 섞이지 않게 → `null`.
 * - 24시간 시장(`always-open`): 마감이 없다 → `null`.
 *
 * 판정을 스캐너 결과의 계산 시각이 아니라 **지금 시각**으로 한다. 기록기는 이 판정이 통과한 뒤
 * 스캐너를 직접 계산하므로 계산 시각이 곧 지금이고, 캐시에 남은 옛 결과(마감 직후·지난 세션)를
 * 그날 세션으로 잘못 남길 길이 없다.
 */
export function recordableSessionDate(
    spec: MarketSessionSpec,
    now: Date,
    settleMinutes: number
): string | null {
    if (spec.kind === 'always-open') return null;
    const session = lastClosedSessionDate(spec, now, settleMinutes);
    return zonedDate(now, spec.timeZone) === session ? session : null;
}

/** 직전 거래 세션 — 에피소드가 "이어졌다"고 볼 마지막 포착 세션의 하한. */
export function continuationFloor(
    spec: MarketSessionSpec,
    sessionDate: string
): string {
    return previousSessionDate(spec, sessionDate);
}
