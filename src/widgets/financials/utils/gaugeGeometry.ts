/**
 * 종합 점수 반원 게이지의 기하 — 호 구간, 눈금 위치, 바늘 좌표를 순수 함수로 둔다.
 */

/** 게이지 SVG viewBox 크기. */
export const GAUGE_VIEWBOX_W = 200;
export const GAUGE_VIEWBOX_H = 130;
/** 등급 호의 선 두께. */
export const GAUGE_STROKE_WIDTH = 14;

const GAUGE_CX = 100;
/** 위쪽 눈금 라벨이 viewBox 안에 들어오도록 호 중심을 약간 아래에 둔다. */
const GAUGE_CY = 105;
const GAUGE_RADIUS = 80;

/** 점수 범위 — 반원 전체가 이 범위에 대응한다. */
export const SCORE_MIN = 0;
export const SCORE_MAX = 100;

/** 삼각형 바늘 — angle=0(점수 100 방향)으로 그린 뒤 점수 각도로 회전한다. */
const NEEDLE_TIP_LEN = 4;
const NEEDLE_HALF_WIDTH = 6;
const NEEDLE_INNER_GAP = 12;
/** 바늘 축을 고정하는 피벗 원 반지름. */
export const NEEDLE_PIVOT_RADIUS = 4;
/** 호와 바늘의 중심 좌표. */
export const GAUGE_CENTER = { x: GAUGE_CX, y: GAUGE_CY } as const;

/** 점수 1단위당 각도 — 180° 반원이 100점을 담는다. */
const DEGREES_PER_SCORE_UNIT = 1.8;

/** 호 바깥에 라벨로 그리는 눈금 값. */
export const TICK_VALUES: readonly number[] = [0, 25, 50, 75, 100];
const TICK_LABEL_OFFSET = 16;
const TICK_LABEL_RADIUS = GAUGE_RADIUS + TICK_LABEL_OFFSET;
/** 양 끝 눈금은 호 끝과 겹치지 않도록 아래로 내린다. */
const EDGE_TICK_DY = 14;

/** 호 한 구간 — 점수 범위와 stroke 색(`stroke="currentColor"`에 얹는 text 색 클래스). */
interface GaugeSegment {
    from: number;
    to: number;
    strokeClass: string;
}

/**
 * 등급 램프 토큰을 쓰는 5구간 팔레트. 각 구간은 core `financialsScorecard`의 등급 기준과 정확히
 * 일치한다.
 *   0–34 F(빨강) / 35–49 D(주황) / 50–64 C(노랑) / 65–79 B(라임) / 80–100 A(초록)
 */
export const SEGMENTS: readonly GaugeSegment[] = [
    { from: 0, to: 35, strokeClass: 'text-grade-f' },
    { from: 35, to: 50, strokeClass: 'text-grade-d' },
    { from: 50, to: 65, strokeClass: 'text-grade-c' },
    { from: 65, to: 80, strokeClass: 'text-grade-b' },
    { from: 80, to: 100, strokeClass: 'text-grade-a' },
];

/** 점수 → 반원 위 각도(라디안). 0점이 왼쪽 끝(π), 100점이 오른쪽 끝(0)이다. */
function scoreToAngle(score: number): number {
    return (1 - score / SCORE_MAX) * Math.PI;
}

function pointOnCircle(
    radius: number,
    score: number
): { x: number; y: number } {
    const angle = scoreToAngle(score);
    return {
        x: GAUGE_CX + radius * Math.cos(angle),
        y: GAUGE_CY - radius * Math.sin(angle),
    };
}

/** 구간 하나의 SVG 호 경로. */
export function segmentArcPath(segment: GaugeSegment): string {
    const start = pointOnCircle(GAUGE_RADIUS, segment.from);
    const end = pointOnCircle(GAUGE_RADIUS, segment.to);
    return `M ${start.x} ${start.y} A ${GAUGE_RADIUS} ${GAUGE_RADIUS} 0 0 1 ${end.x} ${end.y}`;
}

type TextAnchor = 'start' | 'end' | 'middle';

/** 양 끝 눈금만 안쪽으로 정렬하고 나머지는 가운데 정렬한다. */
const TICK_ANCHOR: Partial<Record<number, TextAnchor>> = {
    [SCORE_MIN]: 'start',
    [SCORE_MAX]: 'end',
};

/** 눈금 라벨의 위치와 정렬. */
export function tickLabelPlacement(value: number): {
    x: number;
    y: number;
    anchor: TextAnchor;
} {
    const { x, y } = pointOnCircle(TICK_LABEL_RADIUS, value);
    const isEdge = value === SCORE_MIN || value === SCORE_MAX;
    return {
        x,
        y: isEdge ? y + EDGE_TICK_DY : y,
        anchor: TICK_ANCHOR[value] ?? 'middle',
    };
}

/** 점수를 게이지 범위로 자른다. 점수가 없으면 0으로 둔다. */
function clampScore(score: number | null): number {
    return score === null
        ? SCORE_MIN
        : Math.min(SCORE_MAX, Math.max(SCORE_MIN, score));
}

/**
 * 바늘 회전각(도). 바늘은 오른쪽(100점)을 향하게 그려 두므로 `(100 - 점수) * 1.8°`만큼 왼쪽으로
 * 돌린다.
 */
export function needleRotationDeg(score: number | null): number {
    return -(SCORE_MAX - clampScore(score)) * DEGREES_PER_SCORE_UNIT;
}

/** 회전 전(오른쪽을 향한) 삼각형 바늘의 꼭짓점 좌표 문자열. */
export function needlePoints(): string {
    const tip = `${GAUGE_CX + GAUGE_RADIUS + NEEDLE_TIP_LEN},${GAUGE_CY}`;
    const baseX = GAUGE_CX + NEEDLE_INNER_GAP;
    const baseTop = `${baseX},${GAUGE_CY - NEEDLE_HALF_WIDTH}`;
    const baseBottom = `${baseX},${GAUGE_CY + NEEDLE_HALF_WIDTH}`;
    return `${tip} ${baseTop} ${baseBottom}`;
}
