export const DEFAULT_LINE_WIDTH = 1;
export const DEFAULT_POINT_MARKERS_RADIUS = 2;
export const INACTIVE_PANE_INDEX = -1;
export const FIRST_INDICATOR_PANE_INDEX = 1;
export const LABEL_SERIES_INDEX = 0; // 첫 번째 시리즈에만 label을 표시한다
export const REGION_LOWER_PRICE_INDEX = 0; // keyPrices[0] = 구간 하단 가격
export const REGION_UPPER_PRICE_INDEX = 1; // keyPrices[1] = 구간 상단 가격
export const REGION_KEY_PRICE_MIN_LENGTH = REGION_UPPER_PRICE_INDEX + 1; // region은 최소 상단/하단 두 개의 keyPrice가 필요하다
export const MARKER_POSITION = 'aboveBar' as const;
export const MARKER_SHAPE = 'arrowDown' as const;

// 모든 패턴 오버레이 시리즈에 공통으로 적용되는 차트 표시 기본값
export const BASE_PATTERN_SERIES_OPTIONS = {
    lineWidth: DEFAULT_LINE_WIDTH,
    priceLineVisible: false,
    lastValueVisible: false,
} as const;

// 차트 보조지표 선택을 새로고침 후에도 복원하기 위한 localStorage 키.
// 'siglens.chart.*' 단일 네임스페이스로 모아 오타·충돌을 막고 영속 대상을 한눈에 보이게 한다.
// 영속 자체는 usePersistentState가 담당하고, 여기서는 키 목록만 단일 소스로 관리한다.
const STORAGE_PREFIX = 'siglens.chart';
export const STORAGE_KEYS = {
    visible: `${STORAGE_PREFIX}.visible`,
    maPeriods: `${STORAGE_PREFIX}.ma.periods`,
    emaPeriods: `${STORAGE_PREFIX}.ema.periods`,
    overlay: (key: string): string => `${STORAGE_PREFIX}.overlay.${key}`,
} as const;
