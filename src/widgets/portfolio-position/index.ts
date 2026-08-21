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
// describeAvgFloor도 같은 이유로 barrel에 추가한다 — `[symbol]/position/page.tsx`
// (app 레이어)가 현재가의 "몇 층" 문구를 이 함수로 파생시켜, 회원 전용
// PositionBuilding이 쓰는 저층/중층/고층/펜트하우스·옥상 위/지하 세대 어휘와
// 절대 어긋나지 않게 한다(단일 source, MISTAKES #2와 동일 원칙).
export { formatAmount, describeAvgFloor } from './lib/positionBuildingNotes';

// 순수 함수 모음이라 훅을 못 쓴다 — 호출부가 번역자를 넘긴다.
export type { PositionTranslator } from './lib/positionBuildingNotes';
