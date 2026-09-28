/**
 * OpenInterestChart·StrikeVolumeChart 공용 SVG 레이아웃·색 상수.
 *
 * 두 차트는 옵션 페이지에 나란히 렌더되어 같은 viewport·같은 막대 비율·같은
 * 라벨 규칙을 공유해야 사용자가 둘을 비교하는 시선 흐름이 어색해지지 않는다.
 * 예전에는 "한쪽 패딩만 미세조정할 수 있다"는 이유로 두 파일에 복제해 두었는데,
 * 그 조정은 한 번도 없었고 복제본끼리 맞추라는 주석만 늘었다(막대 불투명도가
 * 한쪽만 0.7로 남아 라이트에서 3:1을 밑돈 적도 있다). 한 차트만 달라져야 하면
 * 그 차트 파일에서 이 값을 덮어쓴다.
 */

export const SVG_WIDTH = 600;
export const SVG_HEIGHT = 240;
export const PAD_TOP = 30;
export const PAD_BOTTOM = 50;
export const PAD_LEFT = 12;
export const PAD_RIGHT = 12;

export const CHART_WIDTH = SVG_WIDTH - PAD_LEFT - PAD_RIGHT;
export const CHART_HEIGHT = SVG_HEIGHT - PAD_TOP - PAD_BOTTOM;
export const MIDLINE_Y = PAD_TOP + CHART_HEIGHT / 2;
export const HALF_HEIGHT = CHART_HEIGHT / 2;

// Semantic chart tokens — referenced directly because SVG attributes
// (`fill`, `stroke`) don't consume Tailwind classes targeting `color`.
// Max Pain and the current-price line intentionally share `ui-warning`
// since both communicate "pivot levels worth watching"; the dashed vs
// solid stroke pattern differentiates them visually.
export const COLOR_CALL = 'var(--color-chart-bullish)';
export const COLOR_PUT = 'var(--color-chart-bearish)';

/**
 * 차트 안 범례는 막대와 같은 색으로 칠하고 싶어지지만, **글자다.**
 * `chart-*`는 그래픽 기준(3:1)에 맞춘 색이라 라이트 카드 위에서 4.82/4.89로
 * 본문 기준을 겨우 넘는다. 같은 자리에서 `-text` 짝은 6.99~12.15다.
 * `bg-chart-*` 색칩(HTML 범례)은 그래픽이므로 그대로 둔다. 어떤 가드도 SVG
 * `fill`이나 `var()` 문자열은 보지 않는다.
 */
export const LABEL_CALL = 'var(--color-ui-success-text)';
export const LABEL_PUT = 'var(--color-ui-danger-text)';
export const COLOR_GUIDE_LINE = 'var(--color-ui-warning)';
export const COLOR_MIDLINE = 'var(--color-secondary-600)';
export const COLOR_LABEL = 'var(--color-secondary-500)';

/*
 * 0.7이었는데 라이트 카드 위에서 Call 막대가 2.85:1로 그래픽 기준(3:1)을
 * 밑돌았다 — 다크에서는 통과해서 다크만 보면 안 보이는 결함이다. 0.85에서
 * 실측 3.70:1.
 */
export const BAR_OPACITY = 0.85;

// 슬롯 너비 대비 막대 두께 비율 — 슬롯 양쪽에 약간의 간격을 남겨
// 인접 strike와 시각적으로 구분되도록 한다.
export const BAR_WIDTH_FILL_RATIO = 0.7;

// x축에 동시에 보여줄 라벨 최대 개수. PLTR 같은 weekly + LEAPS 종목은
// strike 수가 30~50개에 달해 모든 라벨을 그리면 글자가 겹치고 시각적으로
// 답답해진다. 이 값을 기준으로 균등하게 thinning하고, 현재가·Max Pain·양 끝
// strike는 항상 표시되도록 보존한다.
export const MAX_X_AXIS_LABELS = 10;

// 라벨 thinning 후에도 글자 길이를 줄여 가독성을 확보하기 위한 회전 임계값.
// 라벨 개수가 이 임계값 이상이면 -45° 회전한다.
export const LABEL_ROTATION_THRESHOLD = 7;

// x축 라벨을 차트 영역 하단에서 띄울 px 거리. font baseline 위치 보정.
export const X_AXIS_LABEL_OFFSET_PX = 14;
// 가독성을 잃지 않는 한도에서, 회전 라벨은 한 글자만큼 작게 잡는다.
export const ROTATED_LABEL_FONT_SIZE = 8;
export const STRAIGHT_LABEL_FONT_SIZE = 9;
