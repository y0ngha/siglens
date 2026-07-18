'use client';

import type React from 'react';
import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/shared/lib/cn';
import { useEscapeKey } from '@/shared/hooks/useEscapeKey';
import { useOnClickOutside } from '@/shared/hooks/useOnClickOutside';
import {
    getTooltipPosition,
    type TooltipPosition,
} from '@/shared/lib/tooltipPosition';
import { formatSignedPercent } from '@/shared/lib/priceFormat';
import {
    BAND_COUNT,
    type PositionModel,
    type RangeClamp,
} from '../lib/positionGeometry';
import {
    AVG_LABEL_PREFIX,
    avgFloorPrefixGlyph,
    avgFloorVisualNote,
    buildAriaLabel,
    buildFloorTooltips,
    CENTER_X,
    computeActiveFloorTooltipContent,
    CURRENT_LABEL_PREFIX,
    describeAvgFloor,
    formatFloorTooltipText,
    formatUsd,
    formatUsdCompactForSvgLabel,
    type FloorPointer,
    ISO_DX,
    LABEL_GAP,
    outOfRangeNote,
    VIEWBOX_W,
} from '../lib/positionBuildingNotes';

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

/* ------------------------------------------------------------------------ *
 * 아이소메트릭 투영 (2:1)
 *
 * 건물은 5개 층(model.bands, low→high)을 쌓은 사각기둥이다. 지붕(back/left/
 * right/front 4개 모서리로 이뤄진 마름모)만 아이소메트릭 스큐 폴리곤이고, 각
 * 층은 그 마름모를 수직(순수 세로축, 스큐 없음)으로 밀어내린 슬래브다. 왼쪽/
 * 오른쪽 두 면만 보이도록(뒷면은 숨김) 표준 아이소메트릭 박스 투영을 쓴다.
 * 마커·라벨은 이 투영과 무관하게 항상 upright(수평/수직) 좌표에 배치한다.
 * ------------------------------------------------------------------------ */

// VIEWBOX_W/CENTER_X/ISO_DX/LABEL_GAP moved to lib/positionBuildingNotes.ts
// (single source shared with SVG_LABEL_AVAILABLE_WIDTH there) — imported above.
// 280 → 360: widened horizontally (audit finding #1) so the avg/current
// marker labels never clip for realistic per-share prices (up to ~$99,999
// before IN_SVG_COMPACT_THRESHOLD kicks in). Building geometry below (ISO_DX,
// FLOOR_H, ...) is unchanged — the extra width is pure side padding for
// labels, which already lived in the margins by design.
const VIEWBOX_H = 360;

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

// AVG_LABEL_PREFIX/CURRENT_LABEL_PREFIX/SVG_LABEL_AVAILABLE_WIDTH/
// estimateSvgLabelWidth moved to lib/positionBuildingNotes.ts — imported above.

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
function frontY(pos: number, clamped: RangeClamp): number {
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
    // 층 hover/tap(pin) 상태 — volumeByBand가 없으면 절대 set되지 않아(아래 이벤트
    // 핸들러가 통째로 붙지 않음) 항상 null로 남고, 건물은 이 기능 추가 전과 동일하게
    // 렌더된다. 마우스/터치 전용(포인터 어포던스) — 층 <g>는 role="img" 자손이라
    // 키보드 포커스를 받지 않는다(아래 렌더 루프의 role="img" 주석 참고).
    //
    // hover(마우스 진입)와 pinned(클릭/탭 토글)를 별도 state로 둔다 — 마우스로
    // 클릭하려면 먼저 그 위에 마우스가 올라가 있어야 하므로 hover가 항상 click보다
    // 먼저 켜진다. 하나로 합치면 "hover 중인 층을 클릭"할 때 toggle 로직이 "이미
    // 켜져 있었다"고 오판해 방금 연 툴팁을 곧바로 닫아버리는 경합이 생긴다. 분리하면
    // hover는 즉시 미리보기를, 클릭/탭은 그와 무관하게 "고정" 여부만 토글해 데스크톱
    // hover와 모바일 tap-to-toggle이 서로 간섭하지 않는다. 활성 층은 hover가 있으면
    // hover를 우선하고, 없으면 pinned를 쓴다.
    const [hoverFloor, setHoverFloor] = useState<FloorPointer | null>(null);
    const [pinnedFloor, setPinnedFloor] = useState<FloorPointer | null>(null);

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

    const containerRef = useRef<HTMLDivElement>(null);

    // 탭/클릭으로 고정(pinned)한 층은 건물 바깥을 클릭/탭하면 닫힌다(InfoTooltip과
    // 동일한 useOnClickOutside). hover 미리보기는 mouseleave/blur가 이미 처리하므로
    // 여기선 pinnedFloor만 정리한다.
    useOnClickOutside(containerRef, () => setPinnedFloor(null), {
        enabled: pinnedFloor !== null,
    });

    // WCAG 1.4.13 — 클릭/탭으로 고정(pinned)한 툴팁은 Escape로도 닫을 수 있어야
    // 한다(InfoTooltip.tsx와 동일 idiom). useOnClickOutside는 pointerdown만
    // 처리하므로 키보드 사용자용 dismiss 경로가 별도로 필요하다. 층 <g> 자체는
    // 더 이상 포커스 가능하지 않지만(아래 렌더 루프의 role="img" 주석 참고),
    // 이 Escape 핸들러는 문서 전역에 바인딩되므로 포커스 위치와 무관하게
    // pinnedFloor를 닫는다.
    useEscapeKey(() => setPinnedFloor(null), pinnedFloor !== null);

    // 전체 밴드의 툴팁 콘텐츠를 한 번만 계산해 활성 층 파생(아래)과 렌더 루프
    // (층별 hover 콘텐츠 조회) 둘 다 재사용한다 — 같은 band index를 두 곳에서
    // 따로 계산하지 않는다(MISTAKES #2, buildFloorTooltips 주석 참고). 매 렌더
    // 재계산을 막기 위해 useMemo로 감싼다(MISTAKES #10 — props/state 파생
    // 배열/객체는 useMemo). model.bands.length는 이미 model에 포함돼 있으므로
    // deps는 model만으로 충분하다(별도 bandCount 파생값을 deps에 얹지 않는다).
    const floorTooltips = useMemo(
        () =>
            buildFloorTooltips(
                model,
                volumeByBand,
                low52w,
                high52w,
                model.bands.length
            ),
        [model, volumeByBand, low52w, high52w]
    );

    // model.bands.length는 volumeByBand 인덱싱(아래)과 describeAvgFloor 둘 다에
    // 필요해 파생 변수 구간에서 한 번만 계산한다(단일 source, 중복 선언 금지).
    // 모든 hook 호출(useState/useRef/useOnClickOutside/useEscapeKey/useMemo) 뒤에
    // 둔다(Custom Hook Declaration Order — CONVENTIONS.md).
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

    const activeFloor = hoverFloor ?? pinnedFloor;
    const tooltipPositioned =
        activeFloor !== null && measuredFloorIndex === activeFloor.index;

    const activeFloorTooltipContent = computeActiveFloorTooltipContent(
        activeFloor,
        floorTooltips
    );
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

                    const floorTooltip = floorTooltips[i];
                    const isInteractive = floorTooltip !== null;
                    const isActive = isInteractive && activeFloor?.index === i;

                    // 핸들러는 아래에서 isInteractive일 때만 <g>에 붙으므로 여기선
                    // 별도 가드가 필요 없다. activate/deactivate는 hover(마우스) 미리보기,
                    // togglePin(클릭/탭)은 "고정" — 서로 다른 state라 데스크톱에서 hover
                    // 중인 층을 클릭해도 hover가 방금 연 툴팁을 click이 곧바로 닫아버리는
                    // 경합이 없다(상단 state 주석 참고).
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
                    const togglePin = (rect: DOMRect) => {
                        setPinnedFloor(prev =>
                            prev?.index === i ? null : { index: i, rect }
                        );
                    };
                    const toggleClick = (e: React.MouseEvent<SVGGElement>) => {
                        togglePin(e.currentTarget.getBoundingClientRect());
                    };

                    return (
                        <g
                            key={`${band.fromPct}-${band.toPct}`}
                            data-testid="building-floor"
                            // ⚠️ 의도적으로 role/tabIndex/키보드 핸들러가 없다(이전 라운드의
                            // role="button"+tabIndex+onKeyDown 시도를 되돌렸다). 이 <g>는
                            // 부모 <svg role="img">의 자손이다 — WAI-ARIA는 role="img" 서브트리
                            // 안의 포커스 가능/인터랙티브한 자손을 접근성 트리에서 통째로
                            // flatten한다(role="button"을 줘도 스크린리더는 절대 못 읽고,
                            // 포커스만 "보이지 않게" 걸려 키보드 사용자가 갇힌다). 그래서 층
                            // hover/tap 툴팁("거주율 N%")은 마우스/터치를 쓰는 시각 사용자
                            // 전용 보강일 뿐이다 — 핵심 정보(평단/현재가/수익률/range%/floor
                            // 안내)는 이미 svg 자체의 role="img" aria-label에 전부 담겨 있다
                            // (buildAriaLabel). 그러므로 여기 남기는 건 포인터 어포던스
                            // (onMouseEnter/onMouseLeave=hover, onClick=탭-투-핀, 터치는
                            // hover가 없어 클릭으로 대체)뿐이다. aria-hidden은 별도로 줄
                            // 필요 없다 — role="img"가 이미 자손 전체를 접근성 트리에서
                            // 제외한다.
                            className={
                                isInteractive
                                    ? 'cursor-pointer touch-manipulation'
                                    : undefined
                            }
                            onMouseEnter={isInteractive ? activate : undefined}
                            onMouseLeave={
                                isInteractive ? deactivate : undefined
                            }
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
                            {/* hover/pinned(클릭) 하이라이트 — 시각 피드백 전용(aria-hidden),
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
                    {/* nested ternary 대신 early-return 헬퍼로 분기(FF.md §1-E) */}
                    {avgFloorPrefixGlyph(model.avgClamped)}
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

            {/* 층 hover/탭 리드아웃 — 마우스/터치를 쓰는 시각 사용자 전용 보강 표시다
                (층 <g>는 role="img" 자손이라 키보드 포커스를 받지 않는다, 위 렌더
                루프 주석 참고). 접근성 채널은 이미 svg 자체의 role="img" aria-label
                (buildAriaLabel)이 핵심 정보를 전달하므로 이 줄은 중복 announce를
                막기 위해 aria-hidden이다 — floating 툴팁(아래)과 동일한 "시각
                전용" 취급. volumeByBand가 없으면 아예 렌더하지 않아 건물이 이 기능
                추가 전과 DOM 상 동일하게 유지된다. */}
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
                끼어들지 않는다(useOnClickOutside에 별도 tooltipRef가 필요 없다).

                role="tooltip"이 아니라 aria-hidden="true"다 — 이 노드는 document.body
                최상위로 포털되어 svg role="img" 서브트리 **밖**에 산다. role="tooltip"을
                쓰려면 반드시 트리거 요소의 aria-describedby로 연결돼야 하는데(WAI-ARIA,
                MISTAKES a11y #3), 층 <g>는 위 렌더 루프 주석대로 의도적으로 인터랙티브/
                포커스 가능한 요소가 아니므로 그런 트리거가 없다. role="tooltip"만
                남기면 트리거 없이 announce되는 고아 노드가 돼(이전 라운드 결함) 스크린
                리더가 svg aria-label과 무관하게 이 텍스트를 뜬금없이 읽는다. 그래서
                below-building 리드아웃(위)과 동일하게 순수 시각 보강으로 다뤄
                접근성 트리에서 제외한다. */}
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
                        aria-hidden="true"
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
