/**
 * CTA(평단 없는 방문자) 건물의 입력 — 범위·현재가만으로 현재가 위치 모델을 만든다.
 */
import { computePosition, type PositionModel } from './positionGeometry';

/** CTA 건물을 그리는 데 필요한 값. */
export interface CtaBuildingInput {
    model: PositionModel;
    low52w: number;
    high52w: number;
    current: number;
}

/**
 * 평단 없이 현재가만 담은 건물의 입력. 평단 자리에 `avg: current`를 넣는다 —
 * `avg`는 양수 가드에만 쓰이고 이 화면이 읽는 currentPos/currentClamped는
 * `current`만으로 정해진다(`[symbol]/position/page.tsx`의
 * resolveCurrentPricePosition과 같은 근거). 범위·현재가가 비었거나 퇴화
 * 입력이면 null → 건물 없이 문구 CTA만.
 */
export function resolveCtaBuilding(
    low52w: number | null,
    high52w: number | null,
    lastClose: number | null
): CtaBuildingInput | null {
    if (low52w === null || high52w === null || lastClose === null) return null;
    const model = computePosition({
        low52w,
        high52w,
        current: lastClose,
        avg: lastClose,
    });
    return model === null
        ? null
        : { model, low52w, high52w, current: lastClose };
}
