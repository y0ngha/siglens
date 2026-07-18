/**
 * 회원 포지션의 결정적(non-AI) 손익/거리 상태 계산.
 * "내 평단 기준으로 분석했어요" 배지 옆에 노출되는 순수 사실 층(scope fence:
 * 매수/매도 판단·목표가·진입구간 등 core AI 도메인 값은 절대 포함하지 않는다 —
 * 평가손익·수익률·범위 내 위치·고점/저점까지 거리만 담는다).
 * 시간/난수/DOM 의존 없는 순수 함수 — computePosition(positionGeometry.ts)의
 * returnPct/currentPos 산출을 그대로 재사용해 range 기하 계산(clamp 등)을 중복하지
 * 않는다. 단, computePosition의 `rangePositionPct` 필드 자체는 avg(평단) 기준
 * 위치라 그대로 쓰지 않는다 — 이 위젯은 PositionCard/PositionBuilding("내 평단이
 * 범위 어디에 있나")과 달리 "지금 이 가격이 범위 어디쯤인가"를 보여줘야 하므로
 * `model.currentPos`(0..1, clamped)를 100배해 rangePositionPct로 쓴다.
 */

import { computePosition } from './positionGeometry';

export interface PositionStatusInputs {
    avg: number; // 회원 평단
    quantity: number; // 회원 보유 수량
    current: number; // lastClose
    low52w: number;
    high52w: number;
}

export interface PositionStatus {
    avg: number;
    quantity: number;
    /** (current - avg) * quantity — 평가손익(달러). */
    unrealizedPnl: number;
    /** (current - avg) / avg * 100 — computePosition과 동일 산식. */
    returnPct: number;
    /** [low52w, high52w] 안에서 current(현재가)의 위치, 0..100(clamped). avg 기준이 아니다. */
    rangePositionPct: number;
    /** (high52w - current) / current * 100 — 항상 >= 0 (high52w >= current). */
    distanceToHighPct: number;
    /** (low52w - current) / current * 100 — 항상 <= 0 (low52w <= current). */
    distanceToLowPct: number;
}

/**
 * avg/quantity/current/low52w/high52w를 결정적 포지션 상태로 변환한다.
 * quantity가 비유한값이거나 0 이하이면, 또는 computePosition이 range/가격
 * degeneracy로 null을 반환하면 null — 호출부는 컴포넌트를 렌더하지 않아야 한다.
 */
export function computePositionStatus(
    input: PositionStatusInputs
): PositionStatus | null {
    const { avg, quantity, current, low52w, high52w } = input;

    if (!Number.isFinite(quantity) || quantity <= 0) return null;

    const model = computePosition({ low52w, high52w, current, avg });
    if (model === null) return null;

    const unrealizedPnl = (current - avg) * quantity;
    const distanceToHighPct = ((high52w - current) / current) * 100;
    const distanceToLowPct = ((low52w - current) / current) * 100;

    return {
        avg,
        quantity,
        unrealizedPnl,
        returnPct: model.returnPct,
        rangePositionPct: model.currentPos * 100,
        distanceToHighPct,
        distanceToLowPct,
    };
}
