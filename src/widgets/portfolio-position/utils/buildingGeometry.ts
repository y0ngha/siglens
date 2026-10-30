/**
 * 포지션 빌딩 SVG의 좌표 계산 — 아이소메트릭 투영(2:1) 상수, 층 벽면·창문 폴리곤, 지붕,
 * 마커 배치(옥상 위/지하 고정 좌표, 겹침 회피 dodge). 렌더와 무관한 순수 함수만 둔다.
 *
 * 건물은 5개 층(model.bands, low→high)을 쌓은 사각기둥이다. 지붕(back/left/right/front
 * 4개 모서리로 이뤄진 마름모)만 아이소메트릭 스큐 폴리곤이고, 각 층은 그 마름모를
 * 수직(순수 세로축, 스큐 없음)으로 밀어내린 슬래브다. 왼쪽/오른쪽 두 면만 보이도록(뒷면은
 * 숨김) 표준 아이소메트릭 박스 투영을 쓴다. 마커·라벨은 이 투영과 무관하게 항상
 * upright(수평/수직) 좌표에 배치한다.
 */
import {
    BAND_COUNT,
    type PositionModel,
    type RangeClamp,
} from './positionGeometry';

/**
 * viewBox 가로폭 — 360으로 넓힌 몫은 마커 라벨용 좌우 여백이다(실제 주당 가격이 축약 없이 들어가게).
 * 건물 기하(ISO_DY, FLOOR_H, ...)는 그와 무관하다. 라벨 폭 예산(`SVG_LABEL_AVAILABLE_WIDTH`)과
 * 건물 좌표가 같은 상수를 쓰도록 한 파일에 둔다.
 */
export const VIEWBOX_W = 360;
/** 건물 정면 모서리(가로 중앙). */
export const CENTER_X = VIEWBOX_W / 2;

/** 지붕 마름모 반폭(가로). */
export const ISO_DX = 50;

/** 마커 라벨을 건물 좌/우 외곽선에서 띄우는 가로 간격. */
export const LABEL_GAP = 12;

/**
 * 마커 라벨의 텍스트 anchor(text-anchor="end"/"start")에서 viewBox 가장자리까지
 * 남은 여유 폭 — avg 라벨은 왼쪽(CENTER_X - ISO_DX - LABEL_GAP만큼 안쪽에서 anchor,
 * 거기서 왼쪽으로 텍스트가 자란다), current 라벨은 대칭으로 오른쪽. CENTER_X가
 * viewBox 중앙이므로 두 방향의 여유 폭은 같다.
 */
export const SVG_LABEL_AVAILABLE_WIDTH = CENTER_X - ISO_DX - LABEL_GAP;

/** viewBox 세로폭. */
export const VIEWBOX_H = 360;

/**
 * 글자 하나당 대략적인 렌더 폭(px) 추정 — text-[10px] font-medium tabular-nums
 * 라벨 전용. jsdom에는 실제 텍스트 레이아웃 엔진이 없어(getBBox/
 * getComputedTextLength 모두 throw) 클리핑 회귀 테스트가 이 추정치로 "라벨이
 * viewBox 안에 들어가는가"를 검증한다. 한글/심볼(★●)은 정사각형에 가깝게
 * (~1em) 넓고, 숫자·구두점은 더 좁게(~0.6em) — 실제보다 과소평가하지 않도록
 * 보수적으로(넉넉하게) 잡는다.
 */
function estimateGlyphWidthPx(ch: string): number {
    if (ch === ' ') return 3;
    if (/[ㄱ-힣★●]/.test(ch)) return 10; // 한글 + 마커 심볼(★●)
    return 6; // 숫자, $, 쉼표, 마침표
}

/** 라벨 문자열의 대략적인 렌더 폭(px) — 클리핑 회귀 테스트가 쓴다. */
export function estimateSvgLabelWidth(text: string): number {
    return Array.from(text).reduce(
        (sum, ch) => sum + estimateGlyphWidthPx(ch),
        0
    );
}

/** 지붕 마름모 반폭(세로, 2:1 비율 → dx의 절반). */
export const ISO_DY = 25;

/** 층당 세로 픽셀 높이. */
export const FLOOR_H = 30;
/**
 * `BAND_COUNT`는 `positionGeometry.ts`에서 가져온다 — model.bands.length·`[symbol]/position/page.tsx`의
 * 히스토그램 버킷 개수와 항상 같아야 하는 3자 계약이라 여기서 리터럴을 재선언하지 않는다.
 */
const BUILDING_H = FLOOR_H * BAND_COUNT; // 150

/** 지붕 마름모의 뒤쪽(가장 먼) 꼭짓점. */
export const ROOF_BACK_Y = 70;
/** 지붕 마름모의 좌/우 꼭짓점(95). */
export const ROOF_EAVE_Y = ROOF_BACK_Y + ISO_DY;
/** 지붕 마름모의 앞쪽(정면) 꼭짓점(120) — 건물의 정면 모서리 기준선. */
export const ROOF_FRONT_Y = ROOF_BACK_Y + 2 * ISO_DY;

/** 정면 모서리 바닥(270). */
export const GROUND_FRONT_Y = ROOF_FRONT_Y + BUILDING_H;
/** 좌/우 모서리 바닥(245). */
export const GROUND_EAVE_Y = ROOF_EAVE_Y + BUILDING_H;

// 옥상 위(하늘)/지하 마커 배치 — avgClamped·currentClamped 'above'/'below' 대칭 처리.
const SKY_BASEMENT_OFFSET = 34;
const SKY_Y = ROOF_BACK_Y - SKY_BASEMENT_OFFSET;
const BASEMENT_Y = GROUND_FRONT_Y + SKY_BASEMENT_OFFSET;

/** 최근 고점 눈금 라벨의 y. */
export const HIGH_LABEL_Y = ROOF_BACK_Y - 12;
/** 최근 저점 눈금 라벨의 y. */
export const LOW_LABEL_Y = GROUND_FRONT_Y + 18;

const DODGE_X_OFFSET = 11;
/** 마커 반지름(다이아몬드 반대각선) — 원 마커는 이 값의 0.7배. */
export const MARKER_HALF = 6;

/**
 * 두 마커의 그려지는 y 간격이 마커 높이(다이아몬드 = MARKER_HALF*2 = 12px)보다 좁으면 겹친다 —
 * 그 간격에서는 좌우로 벌린다.
 */
const DODGE_MIN_GAP_PX = MARKER_HALF * 2;

/** avg/current out-of-range 안내 텍스트를 각자의 마커 라벨 바로 아래에 두는 세로 간격. */
export const NOTE_Y_OFFSET = 12;

/** 지면 타원을 건물 정면 모서리 바닥보다 살짝 아래로 내리는 거리. */
export const GROUND_ELLIPSE_CY_OFFSET = 6;
/** 지면 타원을 좌/우 외곽선보다 살짝 넓히는 폭. */
export const GROUND_ELLIPSE_RX_OFFSET = 14;

/** viewBox 픽셀 좌표 — 투영 계산과 마커 배치가 같은 좌표계를 쓴다(y는 아래로 증가). */
export interface Point {
    x: number;
    y: number;
}

function lerp(a: Point, b: Point, t: number): Point {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** `<polygon points>`는 "x,y x,y …" 문자열만 받는다. */
export function pointsAttr(points: readonly Point[]): string {
    return points.map(p => `${p.x},${p.y}`).join(' ');
}

/** pos(0..1, high=1)를 건물 정면 모서리의 y좌표로 변환한다. clamped면 옥상 위/지하 고정 좌표를 쓴다. */
export function frontY(pos: number, clamped: RangeClamp): number {
    if (clamped === 'above') return SKY_Y;
    if (clamped === 'below') return BASEMENT_Y;
    return ROOF_FRONT_Y + (1 - pos) * BUILDING_H;
}

/** 층 하나의 좌/우 벽면 폴리곤과 창문 장식 좌표. */
export interface FloorFaces {
    left: string;
    right: string;
    windowsLeft: Point[][];
    windowsRight: Point[][];
}

const WINDOW_T_STARTS = [0.28, 0.58] as const;
const WINDOW_T_WIDTH = 0.14;
const WINDOW_Y_INSET = 8;

/**
 * 벽면 하나(outerTop→frontTop 변)를 따라 창문 2개의 폴리곤 좌표를 계산한다.
 * 좌/우 벽면 모두 frontTop을 공유하고 outerTop만 달라 양쪽에서 재사용한다.
 */
function computeWindows(outerTop: Point, frontTop: Point): Point[][] {
    return WINDOW_T_STARTS.map(t => {
        const top1 = lerp(outerTop, frontTop, t);
        const top2 = lerp(outerTop, frontTop, t + WINDOW_T_WIDTH);
        return [
            { x: top1.x, y: top1.y + WINDOW_Y_INSET / 2 },
            { x: top2.x, y: top2.y + WINDOW_Y_INSET / 2 },
            { x: top2.x, y: top2.y + WINDOW_Y_INSET },
            { x: top1.x, y: top1.y + WINDOW_Y_INSET },
        ];
    });
}

/** 층(floor) 하나의 좌/우 벽면 폴리곤 + 창문 장식 좌표를 계산한다. index 0 = 최저층. */
export function computeFloorFaces(bandIndexFromLow: number): FloorFaces {
    const topOffset = (BAND_COUNT - 1 - bandIndexFromLow) * FLOOR_H;
    const bottomOffset = topOffset + FLOOR_H;
    const outer = (side: -1 | 1, offset: number): Point => ({
        x: CENTER_X + side * ISO_DX,
        y: ROOF_EAVE_Y + offset,
    });
    const frontTop: Point = { x: CENTER_X, y: ROOF_FRONT_Y + topOffset };
    const frontBottom: Point = { x: CENTER_X, y: ROOF_FRONT_Y + bottomOffset };
    const face = (side: -1 | 1): string =>
        pointsAttr([
            outer(side, topOffset),
            frontTop,
            frontBottom,
            outer(side, bottomOffset),
        ]);
    return {
        left: face(-1),
        right: face(1),
        windowsLeft: computeWindows(outer(-1, topOffset), frontTop),
        windowsRight: computeWindows(outer(1, topOffset), frontTop),
    };
}

/** 지붕 마름모 폴리곤. */
export const ROOF_POLYGON = pointsAttr([
    { x: CENTER_X, y: ROOF_BACK_Y },
    { x: CENTER_X + ISO_DX, y: ROOF_EAVE_Y },
    { x: CENTER_X, y: ROOF_FRONT_Y },
    { x: CENTER_X - ISO_DX, y: ROOF_EAVE_Y },
]);

/**
 * 5×20% 구간 팔레트 — 중립 그라디언트다. 높은 층에 '위험' 같은 의미를 입히지 않는다(층 색이 판단처럼
 * 읽히면 안 된다).
 * top→bottom 순서다 — bands[i]는 저점에서 i번째 구간(0=최저)이므로 `BAND_COUNT - 1 - i`로
 * 찾는다. 우측 면은 밝게(lit), 좌측 면은 어둡게(shadow) 해 음영 리듬만 준다 — 색 자체엔
 * 의미가 없다(마커+텍스트가 의미를 담당).
 */
const FACE_LIT_TOKENS: readonly string[] = [
    'text-secondary-500/40',
    'text-secondary-500/35',
    'text-secondary-600/35',
    'text-secondary-600/40',
    'text-secondary-700/40',
];
const FACE_SHADOW_TOKENS: readonly string[] = [
    'text-secondary-800/55',
    'text-secondary-800/50',
    'text-secondary-900/50',
    'text-secondary-900/55',
    'text-secondary-950/55',
];

/** 층 하나의 위→아래 순번과 좌/우 면 색 토큰. */
export interface FloorShading {
    /** 최상층이 0. */
    fromTop: number;
    lit: string;
    shadow: string;
}

/** 층(저점 기준 index)의 위→아래 순번과 좌/우 면 색 토큰. */
export function floorShading(bandIndexFromLow: number): FloorShading {
    const fromTop = BAND_COUNT - 1 - bandIndexFromLow;
    return {
        fromTop,
        lit: FACE_LIT_TOKENS[fromTop],
        shadow: FACE_SHADOW_TOKENS[fromTop],
    };
}

/** ★평단·●현재가 마커의 그려질 좌표. */
export interface MarkerLayout {
    avgX: number;
    avgY: number;
    currentX: number;
    currentY: number;
}

/**
 * 두 마커 좌표를 정한다. 그려지는 y가 마커 높이보다 가까우면(break-even 근처, 둘 다 옥상 위 등)
 * 좌우로 벌린다 — pos 차이가 아니라 화면 y로 판정해야, 한쪽만 범위 밖(옥상 위/지하 고정
 * 좌표)일 때 멀리 떨어진 두 마커를 벌리지 않는다. 평단이 없으면 마커가 하나라 벌리지 않는다.
 */
export function computeMarkerLayout(
    model: PositionModel,
    hasAvg: boolean
): MarkerLayout {
    const avgY = frontY(model.avgPos, model.avgClamped);
    const currentY = frontY(model.currentPos, model.currentClamped);
    const dodge =
        hasAvg && Math.abs(avgY - currentY) < DODGE_MIN_GAP_PX
            ? DODGE_X_OFFSET
            : 0;
    return {
        avgX: CENTER_X - dodge,
        avgY,
        currentX: CENTER_X + dodge,
        currentY,
    };
}
