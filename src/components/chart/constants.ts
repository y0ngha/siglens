export const DEFAULT_LINE_WIDTH = 1;
export const INACTIVE_PANE_INDEX = -1;
export const LABEL_SERIES_INDEX = 0; // 첫 번째 시리즈에만 label을 표시한다
export const REGION_LOWER_PRICE_INDEX = 0; // keyPrices[0] = 구간 하단 가격
export const REGION_UPPER_PRICE_INDEX = 1; // keyPrices[1] = 구간 상단 가격
export const MARKER_POSITION = 'aboveBar' as const;
export const MARKER_SHAPE = 'arrowDown' as const;

// 모든 패턴 오버레이 시리즈에 공통으로 적용되는 차트 표시 기본값
export const BASE_PATTERN_SERIES_OPTIONS = {
    lineWidth: DEFAULT_LINE_WIDTH,
    priceLineVisible: false,
    lastValueVisible: false,
} as const;
