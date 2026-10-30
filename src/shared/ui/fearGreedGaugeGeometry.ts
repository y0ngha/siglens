import { FEAR_GREED_LABEL_CUTOFFS } from '@y0ngha/siglens-core';

const { EXTREME_FEAR_MAX, GREED_MAX } = FEAR_GREED_LABEL_CUTOFFS;

export const GAUGE_CX = 100;
// 호 위쪽 눈금 라벨이 viewBox 안에 들어오도록 둔 여유.
export const GAUGE_CY = 105;
const GAUGE_RADIUS = 80;
export const GAUGE_STROKE_WIDTH = 14;
export const GAUGE_VIEWBOX_W = 200;
// 호 바깥에 그리는 눈금 라벨이 들어갈 여유.
export const GAUGE_VIEWBOX_H = 130;

/** 삼각 바늘 형상 — 각도 0(오른쪽 끝)에서 그린 뒤 점수 각도로 회전한다. */
const NEEDLE_TIP_LEN = 4;
const NEEDLE_HALF_WIDTH = 6;
const NEEDLE_INNER_GAP = 12;
/** 게이지 회전 중심을 시각적으로 anchor하는 작은 피벗 원의 반지름 (SVG units). */
export const NEEDLE_PIVOT_RADIUS = 4;

/** 양 끝 눈금 라벨을 호 끝 높이에서 아래로 내리는 거리 (SVG units). */
const TICK_END_DROP = 14;

/** 호 바깥쪽으로 띄운 눈금 라벨의 반경 오프셋 (SVG units). */
const TICK_LABEL_OFFSET = 16;
const TICK_LABEL_RADIUS = GAUGE_RADIUS + TICK_LABEL_OFFSET;

/**
 * 0과 100은 게이지 양 끝, 50은 시각적 중심선. EXTREME_FEAR_MAX/GREED_MAX 눈금은
 * `FEAR_GREED_LABEL_CUTOFFS`에서 가져오므로 core가 경계를 바꾸면 눈금도 따라 움직인다.
 */
export const TICK_VALUES: ReadonlyArray<number> = [
    0,
    EXTREME_FEAR_MAX,
    50,
    GREED_MAX,
    100,
];

/** 점수 한 단위당 각도 — 180° 반원이 점수 100단위에 걸친다 (180 / 100). */
const DEGREES_PER_SCORE_UNIT = 1.8;

const SCORE_MIN = 0;
const SCORE_MAX = 100;

/** 점수(0..100)를 반원 위의 각(라디안)으로 바꾼다. 0이 왼쪽 끝(π), 100이 오른쪽 끝(0)이다. */
function scoreToRadians(score: number): number {
    return (1 - score / SCORE_MAX) * Math.PI;
}

/** `from`..`to` 점수 구간을 잇는 호의 SVG path `d`. 구간 색 호를 그릴 때 쓴다. */
export function describeSegmentArc(from: number, to: number): string {
    const a1 = scoreToRadians(from);
    const a2 = scoreToRadians(to);
    const x1 = GAUGE_CX + GAUGE_RADIUS * Math.cos(a1);
    const y1 = GAUGE_CY - GAUGE_RADIUS * Math.sin(a1);
    const x2 = GAUGE_CX + GAUGE_RADIUS * Math.cos(a2);
    const y2 = GAUGE_CY - GAUGE_RADIUS * Math.sin(a2);
    return `M ${x1} ${y1} A ${GAUGE_RADIUS} ${GAUGE_RADIUS} 0 0 1 ${x2} ${y2}`;
}

/**
 * 바늘이 오른쪽(score=100 위치)을 가리키도록 그려지므로, 점수가 낮을수록
 * `-(100 - score) * 1.8°`만큼 반시계 방향으로 돌려야 한다.
 */
export function needleRotationDeg(score: number): number {
    return -(SCORE_MAX - score) * DEGREES_PER_SCORE_UNIT;
}

/** 각도 0에서의 삼각 바늘 `points` 속성. 회전은 호출부의 `<g transform>`이 맡는다. */
export const NEEDLE_POINTS: string = [
    [GAUGE_CX + GAUGE_RADIUS + NEEDLE_TIP_LEN, GAUGE_CY],
    [GAUGE_CX + NEEDLE_INNER_GAP, GAUGE_CY - NEEDLE_HALF_WIDTH],
    [GAUGE_CX + NEEDLE_INNER_GAP, GAUGE_CY + NEEDLE_HALF_WIDTH],
]
    .map(([x, y]) => `${x},${y}`)
    .join(' ');

/**
 * 0과 100은 게이지 수평 끝(y=GAUGE_CY)과 같은 높이라 호와 겹친다.
 * 아래로 `TICK_END_DROP` units 내려 호 stroke 하단 바깥에 위치시킨다.
 */
function tickDy(value: number): number {
    return value === SCORE_MIN || value === SCORE_MAX ? TICK_END_DROP : 0;
}

/** 눈금 라벨의 SVG 좌표. */
export function tickLabelPosition(value: number): { x: number; y: number } {
    const a = scoreToRadians(value);
    return {
        x: GAUGE_CX + TICK_LABEL_RADIUS * Math.cos(a),
        y: GAUGE_CY - TICK_LABEL_RADIUS * Math.sin(a) + tickDy(value),
    };
}

/** 0과 100은 viewbox 경계 근처이므로 시작/끝 기준으로 anchor해 잘림을 방지한다. */
export function tickTextAnchor(value: number): 'start' | 'end' | 'middle' {
    if (value === SCORE_MIN) return 'start';
    if (value === SCORE_MAX) return 'end';
    return 'middle';
}
