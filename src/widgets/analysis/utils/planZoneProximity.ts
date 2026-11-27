/**
 * 종가가 진입 구간 "바로 위"인지의 판정 — 계획 상태 배지와 복사용 리포트가 같은 기준을 쓴다.
 * 두 곳이 각자 문턱을 들면 화면은 "바로 위"인데 복사본은 "보다 위"로 어긋난다.
 */
import type { PlanState } from '@y0ngha/siglens-core';

/**
 * 구간 상단 위 거리가 이 값(ATR) 미만이면 "바로 위". 이전 허용 오차(상단 1%)에 들던 종가의
 * 거리 중앙값이 0.20 ATR, 90분위가 0.41 ATR이었으므로 그 띠를 덮는 0.5로 잡았다.
 */
export const NEAR_ZONE_ATR = 0.5;

/**
 * 구간 경계가 정확해(허용 오차 없음) 한 틱 위여도 `above_zone`이라, 거리가 작으면 "바로 위"로 적는다.
 * 거리(`distanceAtr`)를 모르면(`null`) 거짓이다 — 일반 문구를 쓴다.
 */
export function isJustAboveZone(planState: PlanState): boolean {
    return (
        planState.position === 'above_zone' &&
        planState.distanceAtr !== null &&
        planState.distanceAtr < NEAR_ZONE_ATR
    );
}
