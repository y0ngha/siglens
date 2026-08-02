export type SnapPoint = number | string | null;

// 20% — 기본(초기) 접힘. 실제로 보이는 띠는 `snap − 0.03` = 0.17로, 차트를 가리지
// 않는 실측 임계값(0.194~0.215) 아래에 머문다. 산식과 여유 근거는 useMobileSheet 참고.
export const SNAP_PEEK = 0.2;
export const SNAP_HALF = 0.55; // 55% — 드래그 중간 스냅
export const SNAP_FULL = 0.97; // 97% — 전체 열림

export const MOBILE_SNAP_POINTS = [SNAP_PEEK, SNAP_HALF, SNAP_FULL] as const;

// Vaul의 snapPoints prop은 readonly 배열을 허용하지 않아 mutable 사본을 사용한다.
export const SNAP_POINTS_MUTABLE = [...MOBILE_SNAP_POINTS] as number[];

// vaul 드로어 애니메이션과 동일한 easing 곡선.
export const VAUL_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)';

// 드래그 시 손가락 속도 대비 시트 이동 비율 (러버밴드 효과).
export const DRAG_RESISTANCE = 0.6;

// 드래그로 간주하기 위한 최소 이동량(px).
export const DRAG_THRESHOLD_PX = 8;

// 드래그로 PEEK 스냅 발동 임계치 (뷰포트 높이 비율).
export const DRAG_TO_PEEK_THRESHOLD = 0.45;

// 드래그로 HALF 스냅 발동 임계치 (뷰포트 높이 비율).
export const DRAG_TO_HALF_THRESHOLD = 0.12;

// snapBack 애니메이션 지속 시간.
export const SNAP_BACK_DURATION = '0.5s';
