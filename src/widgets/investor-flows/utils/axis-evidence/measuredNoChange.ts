/**
 * 한국 축의 "측정은 됐고 변동이 없다" 판정.
 */
import type { InvestorFlowsSignal } from '@y0ngha/siglens-core';

/**
 * 채점된(`sufficient`) 한국 축에 방향 신호가 하나도 없다 — core가 "보고는 창 안에 있는데 유의미한 변동이 없다"를 중립
 * 측정값(score 0, `kr_*_no_material_change` 또는 일상적 대량 신고 노트)으로 준 경우다. 데이터 부족이 아니므로 "변동 없음"을
 * 근거 줄로 밝힌다. 방향을 다시 판정하지 않고 core 신호의 `direction`만 읽는다.
 */
export function isMeasuredNoChange(
    signals: readonly InvestorFlowsSignal[]
): boolean {
    return signals.every(signal => signal.direction === 'neutral');
}
