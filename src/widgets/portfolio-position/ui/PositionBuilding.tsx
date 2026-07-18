'use client';

import type React from 'react';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/shared/lib/cn';
import { useOnClickOutside } from '@/shared/hooks/useOnClickOutside';
import {
    getTooltipPosition,
    type TooltipPosition,
} from '@/shared/lib/tooltipPosition';
import {
    dynamicDecimals,
    formatSignedPercent,
    formatUsdPrice,
} from '@/shared/lib/priceFormat';
import { BAND_COUNT, type PositionModel } from '../lib/positionGeometry';

interface PositionBuildingProps {
    symbol: string;
    model: PositionModel;
    low52w: number;
    high52w: number;
    current: number;
    avg: number;
    className?: string;
    /**
     * 5개 가격대(밴드)별 최근(52주/252봉) 거래량 비중(%), index 0=최저가
     * 밴드(positionGeometry의 BANDS/이 컴포넌트의 층 순서와 동일). optional —
     * null/undefined면 층 hover가 완전히 비활성화되고 건물은 이 prop이
     * 추가되기 전과 동일하게 렌더된다(`/portfolio` 압축 카드는 이 prop을
     * 전달하지 않아 항상 이 상태다). 순수 raw 히스토그램 — 시그널/해석 없음
     * (scope fence, volumeByBand.ts와 동일 원칙).
     */
    volumeByBand?: readonly number[] | null;
}

/**
 * "$300" 형태 — sub-$1 정밀도 자산군(암호화폐 등)은 고정 2자리 포맷이 "$0"으로
 * 뭉개지므로(예: $0.0006 → "$0") shared/lib/priceFormat의 dynamicDecimals(이미
 * crypto 지표 포맷에 쓰이는 유틸)로 유효자리를 보존한다. PositionGauge는 이 케이스를
 * §6에서 스코프 밖으로 punt했지만, 이 컴포넌트는 misleading "$0"을 최소 방어선으로 삼는다.
 */
function formatUsd(value: number): string {
    if (value !== 0 && Math.abs(value) < 1) {
        return `$${value.toFixed(dynamicDecimals(value))}`;
    }
    return `$${formatUsdPrice(value)}`;
}

/** in-SVG 라벨 폭이 고정 viewBox라 고가 종목(예: BRK.A $600,000+)에서 잘릴 수 있어
 * 이 라벨에서만 축약한다. aria-label은 정밀도를 위해 항상 전체 값을 쓴다. */
const IN_SVG_COMPACT_THRESHOLD = 100_000;

/** Exported so the clipping-regression test can build the exact string the
 * component renders (avoids a second, potentially-drifting copy in the test). */
export function formatUsdCompactForSvgLabel(value: number): string {
    if (Math.abs(value) >= IN_SVG_COMPACT_THRESHOLD) {
        return `$${Math.round(value / 1000)}K`;
    }
    return formatUsd(value);
}

function buildAriaLabel(
    symbol: string,
    model: PositionModel,
    avgDisplay: string,
    currentDisplay: string,
    avgFloorNote: string
): string {
    const returnSign = model.returnPct >= 0 ? '+' : '';
    return (
        `${symbol} 내 위치: 평단 ${avgDisplay}, 현재가 ${currentDisplay}, ` +
        `수익률 ${returnSign}${model.returnPct.toFixed(1)}%, ` +
        `최근 범위의 ${model.rangePositionPct.toFixed(0)}% 지점, ${avgFloorNote}`
    );
}

function outOfRangeNote(clamped: 'above' | 'below' | null): string | null {
    if (clamped === 'above') return '최근 고점보다 높은 곳';
    if (clamped === 'below') return '최근 저점보다 낮은 곳';
    return null;
}

/**
 * floorIndex(0=최저가 인접 층)를 저층/중층/고층/펜트하우스 중 하나로 서술한다.
 * 최하층은 항상 저층, 최상층(bandCount-1)은 항상 펜트하우스 — 그 사이는 3등분해
 * 저층 쪽 절반은 중층, 그 위는 고층으로 갈린다(BAND_COUNT=5 기준: 0→저층,
 * 1~2→중층, 3→고층, 4→펜트하우스). bandCount가 바뀌어도(테스트 등) 안전하게
 * 동작하도록 리터럴 인덱스가 아니라 bandCount 비율로 경계를 계산한다.
 */
function describeFloorTier(floorIndex: number, bandCount: number): string {
    if (bandCount <= 1 || floorIndex === bandCount - 1) return '펜트하우스';
    if (floorIndex === 0) return '저층';
    const midBoundary = Math.floor((bandCount * 2) / 3);
    return floorIndex < midBoundary ? '중층' : '고층';
}

/**
 * ★평단이 건물의 몇 층에 해당하는지 위트 있게 서술한다 — 아파트 메타포의 연장.
 * 순수 포지셔닝 서술만 담당한다(scope fence): 매수/매도 판단이나 진입
 * 퀄리티 평가("잘 사셨어요", "좋은 진입" 등) 언어는 절대 포함하지 않는다 — 그
 * 의미는 siglens-core 분석 도메인의 몫이지 이 프레젠테이션 컴포넌트의 몫이
 * 아니다. avgClamped가 'above'/'below'면 범위 밖(옥상 위/지하) 문구를, null이면
 * avgPos·bandCount로 실제 층수를 계산해 저층/중층/고층/펜트하우스 중 하나를
 * 고른다. avgClamped==='above'|'below' 케이스는 기존 outOfRangeNote와 동일한
 * 부분 문자열("최근 고점보다 높은"/"최근 저점보다 낮은")을 포함해 기존 소비처와
 * 문구 결이 어긋나지 않게 한다. aria-label·마커 아래 노트 등 ★평단을 서술하는
 * 모든 소비처가 이 하나의 빌더를 거쳐 파생해 문구 드리프트를 막는다
 * (buildFloorTooltipContent와 동일 원칙).
 */
/** 범위 밖 ★평단의 아파트 메타포 phrase(방향만) — describeAvgFloor(전체 문구)와
 * avgFloorVisualNote(시각 노트, 폭 제약)가 함께 파생하는 단일 소스라 리터럴을
 * 양쪽에 중복 선언하지 않는다. */
const ROOFTOP_METAPHOR = '옥상 위';
const BASEMENT_METAPHOR = '지하 세대';

export function describeAvgFloor(
    avgPos: number,
    avgClamped: 'above' | 'below' | null,
    bandCount: number
): string {
    if (avgClamped === 'above')
        return `${ROOFTOP_METAPHOR} · 최근 고점보다 높은 곳`;
    if (avgClamped === 'below')
        return `${BASEMENT_METAPHOR} · 최근 저점보다 낮은 곳`;

    const floorIndex = Math.min(
        bandCount - 1,
        Math.max(0, Math.floor(avgPos * bandCount))
    );
    const floorNumber = floorIndex + 1;
    return `${floorNumber}층 · ${describeFloorTier(floorIndex, bandCount)}`;
}

/**
 * SVG 시각 노트(<text data-testid="avg-floor-note">) 전용 문구 — 범위 밖
 * (above/below)이면 메타포 phrase("옥상 위"/"지하 세대")만 반환한다. 뒤 설명
 * 절("· 최근 고점보다 높은 곳" 등)까지 붙이면 end-anchored 노트 폭이
 * SVG_LABEL_AVAILABLE_WIDTH(118px)를 넘겨 좌측(메타포 phrase)이 잘린다(design
 * audit). 마커가 지붕 위/바닥 아래 중앙에 떠 방향은 위치가 이미 말해주고,
 * return-readout의 "최근 범위의 N% 지점"도 함께 보여 시각 정보 손실은 없다.
 * 범위 안이면 "N층 · tier"(78px, 폭 안전)를 그대로 보여준다. 설명 절을 포함한
 * 전체 문구는 aria-label(describeAvgFloor)이 계속 담아 AT 정보량은 유지한다.
 */
function avgFloorVisualNote(
    avgClamped: 'above' | 'below' | null,
    fullNote: string
): string {
    if (avgClamped === 'above') return ROOFTOP_METAPHOR;
    if (avgClamped === 'below') return BASEMENT_METAPHOR;
    return fullNote;
}

/** band index(0=최저가)의 가격 구간 — low/high를 bandCount개 동일 폭으로 나눈다.
 * volumeByBand.ts의 밴드 경계 컨벤션(inclusive-low/exclusive-high, 마지막
 * 밴드만 상한 포함)과 동일 산식이라 두 값이 항상 같은 구간을 가리킨다. */
function bandPriceRange(
    low: number,
    high: number,
    index: number,
    bandCount: number
): { bandLow: number; bandHigh: number } {
    const width = (high - low) / bandCount;
    return {
        bandLow: low + index * width,
        bandHigh: low + (index + 1) * width,
    };
}

interface FloorTooltipContent {
    readonly main: string;
    readonly qualifier: string;
}

/**
 * 층 hover/focus/tap 시 노출하는 문구 — "거주율"(아파트 메타포)로 그 가격대에
 * 몰린 거래량 비중을 서술한다. 실제 주주 명부가 아니라 "이 가격대에서 거래가
 * 얼마나 몰렸는가"의 친근한 은유일 뿐이라, qualifier로 52주 거래량 기준 raw
 * 지표라는 걸 항상 함께 밝힌다(scope fence — 지지/저항 같은 매수·매도 해석으로
 * 오독되지 않게). aria-label·below-building 리드아웃·floating 툴팁 3곳 모두
 * formatFloorTooltipText를 거쳐 이 하나의 빌더에서 파생해 문구 드리프트를 막는다.
 */
function buildFloorTooltipContent(
    bandLow: number,
    bandHigh: number,
    volumePct: number
): FloorTooltipContent {
    return {
        main: `${formatUsd(bandLow)}–${formatUsd(bandHigh)} · 거주율 ${Math.round(volumePct)}%`,
        qualifier: '최근 52주 거래량 기준',
    };
}

/** aria-label·below-building 리드아웃처럼 단일 plain-text가 필요한 소비처용 — floating
 * 툴팁은 main/qualifier를 두 줄로 나눠 렌더하지만(qualifier를 시각적으로 muted 처리),
 * 여기선 괄호로 이어붙여 하나의 문자열로 합친다. */
function formatFloorTooltipText(content: FloorTooltipContent): string {
    return `${content.main} (${content.qualifier})`;
}

/* ------------------------------------------------------------------------ *
 * 아이소메트릭 투영 (2:1)
 *
 * 건물은 5개 층(model.bands, low→high)을 쌓은 사각기둥이다. 지붕(back/left/
 * right/front 4개 모서리로 이뤄진 마름모)만 아이소메트릭 스큐 폴리곤이고, 각
 * 층은 그 마름모를 수직(순수 세로축, 스큐 없음)으로 밀어내린 슬래브다. 왼쪽/
 * 오른쪽 두 면만 보이도록(뒷면은 숨김) 표준 아이소메트릭 박스 투영을 쓴다.
 * 마커·라벨은 이 투영과 무관하게 항상 upright(수평/수직) 좌표에 배치한다.
 * ------------------------------------------------------------------------ */

// 280 → 360: widened horizontally (audit finding #1) so the avg/current
// marker labels never clip for realistic per-share prices (up to ~$99,999
// before IN_SVG_COMPACT_THRESHOLD kicks in). Building geometry below (ISO_DX,
// FLOOR_H, ...) is unchanged — the extra width is pure side padding for
// labels, which already lived in the margins by design.
const VIEWBOX_W = 360;
const VIEWBOX_H = 360;
const CENTER_X = VIEWBOX_W / 2;

const ISO_DX = 50; // 지붕 마름모 반폭(가로)
const ISO_DY = 25; // 지붕 마름모 반폭(세로, 2:1 비율 → dx의 절반)

const FLOOR_H = 30; // 층당 세로 픽셀 높이
// BAND_COUNT는 positionGeometry.ts에서 import(geometry의 단일 source of
// truth) — model.bands.length·[symbol]/position/page.tsx의 히스토그램 버킷
// 개수와 항상 같아야 하는 3자 계약이라 여기서 리터럴을 재선언하지 않는다.
const BUILDING_H = FLOOR_H * BAND_COUNT; // 150

const ROOF_BACK_Y = 70; // 지붕 마름모의 뒤쪽(가장 먼) 꼭짓점
const ROOF_EAVE_Y = ROOF_BACK_Y + ISO_DY; // 지붕 마름모의 좌/우 꼭짓점(95)
const ROOF_FRONT_Y = ROOF_BACK_Y + 2 * ISO_DY; // 지붕 마름모의 앞쪽(정면) 꼭짓점(120) — 건물의 정면 모서리 기준선

const GROUND_FRONT_Y = ROOF_FRONT_Y + BUILDING_H; // 정면 모서리 바닥(270)
const GROUND_EAVE_Y = ROOF_EAVE_Y + BUILDING_H; // 좌/우 모서리 바닥(245)

// 옥상 위(하늘)/지하 마커 배치 — avgClamped·currentClamped 'above'/'below' 대칭 처리.
const SKY_BASEMENT_OFFSET = 34;
const SKY_Y = ROOF_BACK_Y - SKY_BASEMENT_OFFSET;
const BASEMENT_Y = GROUND_FRONT_Y + SKY_BASEMENT_OFFSET;

const HIGH_LABEL_Y = ROOF_BACK_Y - 12;
const LOW_LABEL_Y = GROUND_FRONT_Y + 18;

const DODGE_X_OFFSET = 11;
const MARKER_HALF = 6;
const LABEL_GAP = 12;

/**
 * avg/current가 이 값 미만 차이일 때 겹침을 막기 위해 마커를 좌우로 dodge한다.
 * frontY 스케일은 pos(0..1) 전체가 BUILDING_H(150px)에 대응하므로, 마커 자체의
 * 시각적 높이(다이아몬드 마커 = MARKER_HALF*2 = 12px)보다 좁은 y 간격에서는 항상
 * 마커가 겹친다. 이전 값 0.04(6px 간격)는 이 12px 마커 높이보다 작아 6~12px
 * 사이의 near-break-even 케이스가 dodge 없이 겹쳐 보였다(audit finding #6) — 마커
 * 높이 자체를 임계값으로 삼아 겹침이 발생할 수 있는 모든 간격에서 dodge되도록 한다.
 */
const DODGE_EPSILON = (MARKER_HALF * 2) / BUILDING_H;

/** avg/current out-of-range 안내 텍스트를 각자의 마커 라벨 바로 아래에 두는 세로 간격. */
const NOTE_Y_OFFSET = 12;

/** 지면 타원(ellipse)을 건물 정면 모서리 바닥보다 살짝 아래로, 좌/우 외곽선보다 살짝 넓게 그린다. */
const GROUND_ELLIPSE_CY_OFFSET = 6;
const GROUND_ELLIPSE_RX_OFFSET = 14;

/**
 * in-SVG 마커 라벨 prefix — aria-label(buildAriaLabel, "평단"/"현재가" 전체 표기,
 * 폭 제약 없음)과 별개로 고정 viewBox 폭 제약을 받는 시각 라벨 전용이다. "내
 * 평단"/"현재가"보다 짧게 둬(audit finding #1) 4자리 이상 가격에서도 라벨이
 * viewBox를 벗어나지 않게 한다.
 */
export const AVG_LABEL_PREFIX = '★ 평단 ';
export const CURRENT_LABEL_PREFIX = '● 현재 ';

/**
 * 마커 라벨의 텍스트 anchor(text-anchor="end"/"start")에서 viewBox 가장자리까지
 * 남은 여유 폭 — avg 라벨은 왼쪽(CENTER_X - ISO_DX - LABEL_GAP만큼 안쪽에서 anchor,
 * 거기서 왼쪽으로 텍스트가 자란다), current 라벨은 대칭으로 오른쪽. CENTER_X가
 * viewBox 중앙이므로 두 방향의 여유 폭은 같다.
 */
export const SVG_LABEL_AVAILABLE_WIDTH = CENTER_X - ISO_DX - LABEL_GAP;

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

export function estimateSvgLabelWidth(text: string): number {
    return Array.from(text).reduce(
        (sum, ch) => sum + estimateGlyphWidthPx(ch),
        0
    );
}

interface Point {
    x: number;
    y: number;
}

function lerp(a: Point, b: Point, t: number): Point {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function pointsAttr(points: readonly Point[]): string {
    return points.map(p => `${p.x},${p.y}`).join(' ');
}

/** pos(0..1, high=1)를 건물 정면 모서리의 y좌표로 변환한다. clamped면 옥상 위/지하 고정 좌표를 쓴다. */
function frontY(pos: number, clamped: 'above' | 'below' | null): number {
    if (clamped === 'above') return SKY_Y;
    if (clamped === 'below') return BASEMENT_Y;
    return ROOF_FRONT_Y + (1 - pos) * BUILDING_H;
}

interface FloorFaces {
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
 * 좌/우 벽면 모두 frontTop을 공유하고 outerTop만 다르므로, 이 outerTop을
 * 파라미터화해 좌/우 양쪽에서 재사용한다.
 */
function computeWindows(outerTop: Point, frontTop: Point): Point[][] {
    return WINDOW_T_STARTS.map(t => {
        const top1 = lerp(outerTop, frontTop, t);
        const top2 = lerp(outerTop, frontTop, t + WINDOW_T_WIDTH);
        const bottom1: Point = { x: top1.x, y: top1.y + WINDOW_Y_INSET };
        const bottom2: Point = { x: top2.x, y: top2.y + WINDOW_Y_INSET };
        return [
            { x: top1.x, y: top1.y + WINDOW_Y_INSET / 2 },
            { x: top2.x, y: top2.y + WINDOW_Y_INSET / 2 },
            bottom2,
            bottom1,
        ];
    });
}

/** 층(floor) 하나의 좌/우 벽면 폴리곤 + 창문 장식 좌표를 계산한다. */
function computeFloorFaces(bandIndexFromLow: number): FloorFaces {
    const topOffset = (BAND_COUNT - 1 - bandIndexFromLow) * FLOOR_H;
    const bottomOffset = topOffset + FLOOR_H;

    const leftOuterTop: Point = {
        x: CENTER_X - ISO_DX,
        y: ROOF_EAVE_Y + topOffset,
    };
    const leftOuterBottom: Point = {
        x: CENTER_X - ISO_DX,
        y: ROOF_EAVE_Y + bottomOffset,
    };
    const rightOuterTop: Point = {
        x: CENTER_X + ISO_DX,
        y: ROOF_EAVE_Y + topOffset,
    };
    const rightOuterBottom: Point = {
        x: CENTER_X + ISO_DX,
        y: ROOF_EAVE_Y + bottomOffset,
    };
    const frontTop: Point = { x: CENTER_X, y: ROOF_FRONT_Y + topOffset };
    const frontBottom: Point = { x: CENTER_X, y: ROOF_FRONT_Y + bottomOffset };

    const left = pointsAttr([
        leftOuterTop,
        frontTop,
        frontBottom,
        leftOuterBottom,
    ]);
    const right = pointsAttr([
        rightOuterTop,
        frontTop,
        frontBottom,
        rightOuterBottom,
    ]);

    const windowsLeft = computeWindows(leftOuterTop, frontTop);
    const windowsRight = computeWindows(rightOuterTop, frontTop);

    return { left, right, windowsLeft, windowsRight };
}

const ROOF_POLYGON = pointsAttr([
    { x: CENTER_X, y: ROOF_BACK_Y },
    { x: CENTER_X + ISO_DX, y: ROOF_EAVE_Y },
    { x: CENTER_X, y: ROOF_FRONT_Y },
    { x: CENTER_X - ISO_DX, y: ROOF_EAVE_Y },
]);

/**
 * 5×20% 구간 팔레트 — NEUTRAL 그라디언트, high=위험 의미 부여 금지(design §5).
 * top→bottom 순서로 정의 — BANDS[i]는 low52w에서 i번째 구간(0=최저)이므로
 * 렌더 시 역순 인덱싱(BAND_COUNT - 1 - i)으로 매핑한다. 우측 면은 밝게(lit),
 * 좌측 면은 어둡게(shadow) 해 아이소메트릭 음영 리듬을 준다 — 색상 자체엔
 * 의미가 없다(순수 시각 리듬, 마커+텍스트가 의미를 담당).
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

/**
 * 회원 평단·현재가를 최근 고/저 범위 안에서 시각화하는 아이소메트릭 빌딩.
 * PositionGauge의 idiom(viewBox + currentColor + role="img" + dodge + compact
 * 라벨)을 계승한다. 순수 프레젠테이션 — bands/positions는 전달받은
 * PositionModel에서만 파생한다. 건물 면(face)만 스큐 폴리곤이고, 층 라벨·
 * ★평단·●현재가 마커 텍스트는 항상 upright(가독성).
 */
export function PositionBuilding({
    symbol,
    model,
    low52w,
    high52w,
    current,
    avg,
    className,
    volumeByBand,
}: PositionBuildingProps) {
    // model.bands.length는 volumeByBand 인덱싱(아래)과 describeAvgFloor 둘 다에
    // 필요해 컴포넌트 최상단에서 한 번만 계산한다(단일 source, 중복 선언 금지).
    const bandCount = model.bands.length;
    const avgDisplay = formatUsd(avg);
    const currentDisplay = formatUsd(current);
    const avgFloorNote = describeAvgFloor(
        model.avgPos,
        model.avgClamped,
        bandCount
    );
    // 시각 노트는 폭 제약을 받아 범위 밖에서 phrase만, aria-label은 전체 문구.
    const avgFloorNoteVisual = avgFloorVisualNote(
        model.avgClamped,
        avgFloorNote
    );
    const ariaLabel = buildAriaLabel(
        symbol,
        model,
        avgDisplay,
        currentDisplay,
        avgFloorNote
    );

    const currentNote = outOfRangeNote(model.currentClamped);

    // 층 hover/focus/tap(pin) 상태 — volumeByBand가 없으면 절대 set되지 않아
    // (아래 이벤트 핸들러가 통째로 붙지 않음) 항상 null로 남고, 건물은 이 기능
    // 추가 전과 동일하게 렌더된다.
    //
    // hover(마우스 hover·키보드 focus)와 pinned(클릭/탭 토글)를 별도 state로 둔다
    // — 하나로 합치면 "마우스로 hover 중인 층을 클릭"할 때 focus 이벤트가 먼저
    // activate를 호출해버려 클릭의 toggle 로직이 방금 연 툴팁을 곧바로 닫아버리는
    // 경합이 생긴다(hover가 이미 켠 상태를 click이 "이미 켜져 있었다"고 오판).
    // 분리하면 hover/focus는 즉시 미리보기를, 클릭/탭은 그와 무관하게 "고정"
    // 여부만 토글해 데스크톱 hover와 모바일 tap-to-toggle이 서로 간섭하지 않는다.
    // 활성 층은 hover가 있으면 hover를 우선하고, 없으면 pinned를 쓴다.
    const [hoverFloor, setHoverFloor] = useState<{
        index: number;
        rect: DOMRect;
    } | null>(null);
    const [pinnedFloor, setPinnedFloor] = useState<{
        index: number;
        rect: DOMRect;
    } | null>(null);
    const activeFloor = hoverFloor ?? pinnedFloor;

    // floating 툴팁의 fixed 좌표 + "최초 측정 전엔 숨김"(InfoTooltip과 동일 idiom,
    // shared/lib/tooltipPosition의 getTooltipPosition을 그대로 재사용). "이 인덱스는
    // 이미 측정됐다"를 별도 state(measuredFloorIndex)로 들고 렌더 중에
    // activeFloor.index와 비교해 tooltipPositioned를 파생한다 — setState-in-effect
    // (cascading render 경고)를 피하려고 useEffect로 "층이 바뀌면 리셋"하는 대신,
    // 값 비교 자체가 자연스럽게 리셋 역할을 한다(측정된 적 없는 새 인덱스는 항상
    // 불일치 → invisible).
    const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition>({
        top: 0,
        left: 0,
    });
    const [measuredFloorIndex, setMeasuredFloorIndex] = useState<number | null>(
        null
    );
    const tooltipPositioned =
        activeFloor !== null && measuredFloorIndex === activeFloor.index;

    // 탭/클릭으로 고정(pinned)한 층은 건물 바깥을 클릭/탭하면 닫힌다(InfoTooltip과
    // 동일한 useOnClickOutside). hover 미리보기는 mouseleave/blur가 이미 처리하므로
    // 여기선 pinnedFloor만 정리한다.
    const containerRef = useRef<HTMLDivElement>(null);
    useOnClickOutside(containerRef, () => setPinnedFloor(null), {
        enabled: pinnedFloor !== null,
    });

    const activeVolumePct =
        activeFloor !== null ? volumeByBand?.[activeFloor.index] : null;
    let activeFloorTooltipContent: FloorTooltipContent | null = null;
    if (
        activeFloor !== null &&
        typeof activeVolumePct === 'number' &&
        Number.isFinite(activeVolumePct)
    ) {
        const { bandLow, bandHigh } = bandPriceRange(
            low52w,
            high52w,
            activeFloor.index,
            bandCount
        );
        activeFloorTooltipContent = buildFloorTooltipContent(
            bandLow,
            bandHigh,
            activeVolumePct
        );
    }
    const activeFloorTooltipText = activeFloorTooltipContent
        ? formatFloorTooltipText(activeFloorTooltipContent)
        : null;

    // avg≈current면 두 마커(★/●)가 같은 좌표에서 겹쳐 하나로 보인다 — 좌우로
    // 벌려 break-even(가장 흔한 상태)에서도 두 마커가 구분되게 한다.
    const isDodged = Math.abs(model.avgPos - model.currentPos) < DODGE_EPSILON;
    const avgX = CENTER_X - (isDodged ? DODGE_X_OFFSET : 0);
    const currentX = CENTER_X + (isDodged ? DODGE_X_OFFSET : 0);
    const avgY = frontY(model.avgPos, model.avgClamped);
    const currentY = frontY(model.currentPos, model.currentClamped);

    const avgDisplaySvg = formatUsdCompactForSvgLabel(avg);
    const currentDisplaySvg = formatUsdCompactForSvgLabel(current);

    const returnSign =
        model.returnPct > 0 ? 'gain' : model.returnPct < 0 ? 'loss' : 'flat';
    const returnTokenClass =
        returnSign === 'gain'
            ? 'text-ui-success-text'
            : returnSign === 'loss'
              ? 'text-ui-danger-text'
              : 'text-secondary-400';
    const markerIconTokenClass =
        returnSign === 'gain'
            ? 'text-ui-success'
            : returnSign === 'loss'
              ? 'text-ui-danger'
              : 'text-secondary-100';

    return (
        <div
            ref={containerRef}
            className={cn(
                'flex min-h-[280px] flex-col items-center gap-2',
                className
            )}
            data-testid="position-building"
        >
            <svg
                viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
                // Base (mobile) cap stays 280px — mobile is already right-sized. sm/lg
                // caps are raised to match PositionTabMemberContent's wrapper widths
                // (340px/440px, see that file's comment for why `w-*` and not `max-w-*`
                // is used there) so this svg's own cap isn't the bottleneck. The
                // `/portfolio` compact card (PositionHoldingCard) passes its own
                // `max-w-[200px]` override via the `className` prop on the OUTER div, which
                // stays below every one of these caps at all breakpoints, so it is
                // unaffected by this change.
                className="h-full w-full max-w-[280px] sm:max-w-[340px] lg:max-w-[440px]"
                role="img"
                aria-label={ariaLabel}
            >
                {/* 최근 고점/저점 눈금 라벨 */}
                <text
                    x={CENTER_X}
                    y={HIGH_LABEL_Y}
                    textAnchor="middle"
                    className="text-secondary-400 fill-current text-[10px] font-medium tabular-nums"
                >
                    {formatUsdCompactForSvgLabel(high52w)}
                </text>
                <text
                    x={CENTER_X}
                    y={LOW_LABEL_Y}
                    textAnchor="middle"
                    className="text-secondary-400 fill-current text-[10px] font-medium tabular-nums"
                >
                    {formatUsdCompactForSvgLabel(low52w)}
                </text>

                {/* 층 볼륨 — bands[0]=저점 인접(1층) ... bands[4]=고점 인접(최상층) */}
                {model.bands.map((band, i) => {
                    const faces = computeFloorFaces(i);
                    const litIndex = BAND_COUNT - 1 - i;

                    const volumePct = volumeByBand?.[i];
                    const isInteractive =
                        typeof volumePct === 'number' &&
                        Number.isFinite(volumePct);
                    const isActive = isInteractive && activeFloor?.index === i;
                    let floorTooltipText: string | null = null;
                    if (isInteractive) {
                        const { bandLow, bandHigh } = bandPriceRange(
                            low52w,
                            high52w,
                            i,
                            bandCount
                        );
                        floorTooltipText = formatFloorTooltipText(
                            buildFloorTooltipContent(
                                bandLow,
                                bandHigh,
                                volumePct
                            )
                        );
                    }

                    // 핸들러는 아래에서 isInteractive일 때만 <g>에 붙으므로 여기선
                    // 별도 가드가 필요 없다. activate/deactivate는 hover(마우스)·focus
                    // (키보드) 미리보기, toggleClick은 클릭/탭 "고정" — 서로 다른 state라
                    // 데스크톱에서 hover 중인 층을 클릭해도 hover가 방금 연 툴팁을
                    // click이 곧바로 닫아버리는 경합이 없다(상단 state 주석 참고).
                    const activate = (e: React.SyntheticEvent<SVGGElement>) => {
                        setHoverFloor({
                            index: i,
                            rect: e.currentTarget.getBoundingClientRect(),
                        });
                    };
                    const deactivate = () =>
                        setHoverFloor(prev =>
                            prev?.index === i ? null : prev
                        );
                    const toggleClick = (e: React.MouseEvent<SVGGElement>) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setPinnedFloor(prev =>
                            prev?.index === i ? null : { index: i, rect }
                        );
                    };

                    return (
                        <g
                            key={`${band.fromPct}-${band.toPct}`}
                            data-testid="building-floor"
                            tabIndex={isInteractive ? 0 : undefined}
                            role={isInteractive ? 'group' : undefined}
                            aria-label={floorTooltipText ?? undefined}
                            // 네이티브 <title>의 OS 기본 사각 hover box(및 ~1s 지연)를
                            // 걷어내고 이 컴포넌트 자체의 styled 툴팁으로 대체했다(design
                            // §floor-hover 개정). 포커스 시 그려지는 브라우저 기본 사각
                            // outline도 같은 이유로 제거 — 대신 아래 isActive 하이라이트
                            // (hover·focus·클릭 모두에서 동일하게 뜨는 primary-400 스트로크)
                            // 가 "outline 대체물" 역할을 한다(never bare outline-none).
                            // hover가 클릭보다 먼저 이 오버레이를 켜기 때문에(요소를
                            // 클릭하려면 먼저 마우스가 올라가 있어야 함) 클릭 시에만
                            // 튀어나오는 "포커스 링" 이슈도 자연히 없다.
                            className={
                                isInteractive
                                    ? 'cursor-pointer touch-manipulation outline-none'
                                    : undefined
                            }
                            onMouseEnter={isInteractive ? activate : undefined}
                            onMouseLeave={
                                isInteractive ? deactivate : undefined
                            }
                            onFocus={isInteractive ? activate : undefined}
                            onBlur={isInteractive ? deactivate : undefined}
                            onClick={isInteractive ? toggleClick : undefined}
                        >
                            <polygon
                                points={faces.left}
                                fill="currentColor"
                                className={FACE_SHADOW_TOKENS[litIndex]}
                            />
                            <polygon
                                points={faces.right}
                                fill="currentColor"
                                className={FACE_LIT_TOKENS[litIndex]}
                            />
                            {faces.windowsLeft.map((w, wi) => (
                                <polygon
                                    key={`wl-${wi}`}
                                    points={pointsAttr(w)}
                                    fill="currentColor"
                                    className="text-secondary-950/40"
                                    aria-hidden="true"
                                />
                            ))}
                            {faces.windowsRight.map((w, wi) => (
                                <polygon
                                    key={`wr-${wi}`}
                                    points={pointsAttr(w)}
                                    fill="currentColor"
                                    className="text-secondary-300/50"
                                    aria-hidden="true"
                                />
                            ))}
                            {/* 층 경계선(정면 모서리) */}
                            <line
                                x1={CENTER_X - ISO_DX}
                                y1={ROOF_EAVE_Y + litIndex * FLOOR_H}
                                x2={CENTER_X}
                                y2={ROOF_FRONT_Y + litIndex * FLOOR_H}
                                stroke="currentColor"
                                strokeWidth={0.75}
                                className="text-secondary-950/40"
                            />
                            <line
                                x1={CENTER_X}
                                y1={ROOF_FRONT_Y + litIndex * FLOOR_H}
                                x2={CENTER_X + ISO_DX}
                                y2={ROOF_EAVE_Y + litIndex * FLOOR_H}
                                stroke="currentColor"
                                strokeWidth={0.75}
                                className="text-secondary-950/40"
                            />
                            {/* hover/focus 하이라이트 — 시각 피드백 전용(aria-hidden),
                                기존 face 폴리곤의 currentColor 그라디언트는 그대로 두고
                                위에 얇은 테두리만 덧그린다. */}
                            {isActive && (
                                <>
                                    <polygon
                                        points={faces.left}
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth={1.5}
                                        className="text-primary-400 pointer-events-none"
                                        aria-hidden="true"
                                    />
                                    <polygon
                                        points={faces.right}
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth={1.5}
                                        className="text-primary-400 pointer-events-none"
                                        aria-hidden="true"
                                    />
                                </>
                            )}
                        </g>
                    );
                })}

                {/* 지붕 */}
                <polygon
                    points={ROOF_POLYGON}
                    fill="currentColor"
                    className="text-secondary-400/45"
                    stroke="currentColor"
                    strokeWidth={1}
                    data-testid="building-roof"
                />

                {/* 건물 정면 모서리 세로선 — 마커가 이 선을 기준으로 위치한다 */}
                <line
                    x1={CENTER_X}
                    y1={ROOF_FRONT_Y}
                    x2={CENTER_X}
                    y2={GROUND_FRONT_Y}
                    stroke="currentColor"
                    strokeWidth={1}
                    className="text-secondary-700"
                />
                {/* 좌/우 외곽선 */}
                <line
                    x1={CENTER_X - ISO_DX}
                    y1={ROOF_EAVE_Y}
                    x2={CENTER_X - ISO_DX}
                    y2={GROUND_EAVE_Y}
                    stroke="currentColor"
                    strokeWidth={1}
                    className="text-secondary-700"
                />
                <line
                    x1={CENTER_X + ISO_DX}
                    y1={ROOF_EAVE_Y}
                    x2={CENTER_X + ISO_DX}
                    y2={GROUND_EAVE_Y}
                    stroke="currentColor"
                    strokeWidth={1}
                    className="text-secondary-700"
                />
                {/* 지면 */}
                <ellipse
                    cx={CENTER_X}
                    cy={GROUND_FRONT_Y + GROUND_ELLIPSE_CY_OFFSET}
                    rx={ISO_DX + GROUND_ELLIPSE_RX_OFFSET}
                    ry={ISO_DY / 2}
                    fill="currentColor"
                    className="text-secondary-950/40"
                    aria-hidden="true"
                />

                {/* 내 평단 (★) */}
                <g
                    data-testid="avg-marker"
                    transform={`translate(${avgX} ${avgY})`}
                >
                    <polygon
                        points={`0,${-MARKER_HALF} ${MARKER_HALF * 0.35},${-MARKER_HALF * 0.35} ${MARKER_HALF},0 ${MARKER_HALF * 0.35},${MARKER_HALF * 0.35} 0,${MARKER_HALF} ${-MARKER_HALF * 0.35},${MARKER_HALF * 0.35} ${-MARKER_HALF},0 ${-MARKER_HALF * 0.35},${-MARKER_HALF * 0.35}`}
                        fill="currentColor"
                        className="text-secondary-100"
                    />
                </g>
                <text
                    x={CENTER_X - ISO_DX - LABEL_GAP}
                    y={avgY}
                    textAnchor="end"
                    dominantBaseline="middle"
                    className="fill-current text-[10px] font-medium tabular-nums"
                >
                    <tspan className="fill-secondary-400">
                        {AVG_LABEL_PREFIX}
                    </tspan>
                    <tspan className="fill-secondary-100">
                        {avgDisplaySvg}
                    </tspan>
                </text>
                {/* ★평단 층 안내 — 범위 밖(above/below)이면 기존 옥상 위/지하 문구를,
                    범위 안이면(clamped=null) describeAvgFloor가 계산한 실제 층수를
                    보여준다(이전엔 범위 안일 때 아무 안내도 없었다). 위치 서술만
                    담당 — 매수/매도 판단 언어 금지(scope fence, 위 describeAvgFloor
                    주석 참고). */}
                <text
                    data-testid="avg-floor-note"
                    x={CENTER_X - ISO_DX - LABEL_GAP}
                    y={avgY + NOTE_Y_OFFSET}
                    textAnchor="end"
                    className="fill-secondary-400 text-[10px]"
                >
                    {model.avgClamped === 'above'
                        ? '☁ '
                        : model.avgClamped === 'below'
                          ? '▽B1 '
                          : ''}
                    {avgFloorNoteVisual}
                </text>

                {/* 현재가 (●) */}
                <g
                    data-testid="current-marker"
                    transform={`translate(${currentX} ${currentY})`}
                >
                    <circle
                        r={MARKER_HALF * 0.7}
                        fill="currentColor"
                        className={markerIconTokenClass}
                    />
                </g>
                <text
                    x={CENTER_X + ISO_DX + LABEL_GAP}
                    y={currentY}
                    textAnchor="start"
                    dominantBaseline="middle"
                    className="fill-current text-[10px] font-medium tabular-nums"
                >
                    <tspan className="fill-secondary-400">
                        {CURRENT_LABEL_PREFIX}
                    </tspan>
                    <tspan className="fill-secondary-100">
                        {currentDisplaySvg}
                    </tspan>
                </text>
                {currentNote && (
                    <text
                        data-testid="current-out-of-range-note"
                        x={CENTER_X + ISO_DX + LABEL_GAP}
                        y={currentY + NOTE_Y_OFFSET}
                        textAnchor="start"
                        className="fill-secondary-400 text-[10px]"
                    >
                        {model.currentClamped === 'above' ? '☁ ' : '▽B1 '}
                        {currentNote}
                    </text>
                )}
            </svg>

            {/* 수익/손실 리드아웃 — 위치 서술만(범위 내 어디), good/bad entry 판단 금지 */}
            <p
                data-testid="return-readout"
                className={cn(
                    'text-center text-xs tabular-nums',
                    returnTokenClass
                )}
            >
                수익률 {formatSignedPercent(model.returnPct)} · 최근 범위의{' '}
                {model.rangePositionPct.toFixed(0)}% 지점
            </p>

            {/* 층 hover/focus/탭 리드아웃 — 시각 사용자(마우스 hover·키보드 focus·탭
                모두)용 보강 표시. 접근성 채널은 각 층 <g>의 aria-label이 담당하므로
                (포커스 시 이미 announce됨) 이 줄은 중복 announce를 막기 위해
                aria-hidden이다. volumeByBand가 없으면 아예 렌더하지 않아 건물이 이
                기능 추가 전과 DOM 상 동일하게 유지된다. */}
            {volumeByBand && (
                <p
                    data-testid="floor-volume-readout"
                    aria-hidden="true"
                    className="text-secondary-300 min-h-[1rem] text-center text-xs tabular-nums"
                >
                    {activeFloorTooltipText ?? ' '}
                </p>
            )}

            {/* Floor floating 툴팁 — SVG 자체 bounds에 클리핑되지 않도록 document.body로
                포털한다(InfoTooltip과 동일한 idiom: fixed 좌표 + getTooltipPosition +
                최초 측정 전 invisible). 활성 층의 실제 화면 좌표(getBoundingClientRect,
                activate/toggleClick에서 캡처)를 anchor로 써 280/340/440px 세 breakpoint
                모두에서 viewBox 스케일과 무관하게 정확히 그 층 옆에 뜬다.
                pointer-events-none이라 툴팁 자체를 클릭해도 outside-click 판정에
                끼어들지 않는다(useOnClickOutside에 별도 tooltipRef가 필요 없다). */}
            {activeFloor !== null &&
                activeFloorTooltipContent !== null &&
                typeof document !== 'undefined' &&
                createPortal(
                    <div
                        ref={el => {
                            if (!el) return;
                            const tooltipRect = el.getBoundingClientRect();
                            const pos = getTooltipPosition(
                                activeFloor.rect,
                                tooltipRect,
                                window.innerWidth
                            );
                            if (
                                pos.top !== tooltipPosition.top ||
                                pos.left !== tooltipPosition.left
                            ) {
                                setTooltipPosition(pos);
                            }
                            if (measuredFloorIndex !== activeFloor.index) {
                                setMeasuredFloorIndex(activeFloor.index);
                            }
                        }}
                        role="tooltip"
                        data-testid="floor-tooltip"
                        className={cn(
                            'bg-secondary-800 border-secondary-600 pointer-events-none fixed top-(--tt) left-(--tl) z-9999 max-w-[220px] rounded border p-2 text-xs leading-relaxed shadow-lg',
                            tooltipPositioned ? 'visible' : 'invisible'
                        )}
                        style={
                            {
                                '--tt': `${tooltipPosition.top}px`,
                                '--tl': `${tooltipPosition.left}px`,
                            } as React.CSSProperties
                        }
                    >
                        <p className="text-secondary-100 font-medium tabular-nums">
                            {activeFloorTooltipContent.main}
                        </p>
                        <p className="text-secondary-400 mt-0.5 text-[10px]">
                            {activeFloorTooltipContent.qualifier}
                        </p>
                    </div>,
                    document.body
                )}
        </div>
    );
}
