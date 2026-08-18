export { PositionBuilding } from './ui/PositionBuilding';
export { PositionCard } from './ui/PositionCard';
export { PositionTabContent } from './ui/PositionTabContent';
export { PositionStatusSummary } from './ui/PositionStatusSummary';
export {
    computePosition,
    BAND_COUNT,
    type PositionModel,
    type PositionInputs,
    type PositionBand,
} from './lib/positionGeometry';
export { computeVolumeByBand } from './lib/volumeByBand';
export {
    computePositionStatus,
    type PositionStatus,
    type PositionStatusInputs,
} from './lib/positionStatus';
// formatAmount는 통화 판정(KRW 조기 return)과 sub-$1 dynamicDecimals 분기를
// 한 곳에서만 정의하는 canonical 구현이다 — PositionCard/PositionCta(같은 슬라이스)는
// '../lib/positionBuildingNotes'를 직접 import하고, app 레이어(PositionHoldingCard)는
// 이 barrel을 거친다(app→widgets는 barrel만, CLAUDE.md FSD 규칙).
export { formatAmount } from './lib/positionBuildingNotes';
