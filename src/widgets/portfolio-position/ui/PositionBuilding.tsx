import { cn } from '@/shared/lib/cn';
import { dynamicDecimals, formatUsdPrice } from '@/shared/lib/priceFormat';
import type { PositionModel } from '../lib/positionGeometry';

interface PositionBuildingProps {
    symbol: string;
    model: PositionModel;
    low52w: number;
    high52w: number;
    current: number;
    avg: number;
    className?: string;
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

function formatUsdCompactForSvgLabel(value: number): string {
    if (Math.abs(value) >= IN_SVG_COMPACT_THRESHOLD) {
        return `$${Math.round(value / 1000)}K`;
    }
    return formatUsd(value);
}

function formatSignedPercent(value: number): string {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
}

function buildAriaLabel(
    symbol: string,
    model: PositionModel,
    avgDisplay: string,
    currentDisplay: string
): string {
    const returnSign = model.returnPct >= 0 ? '+' : '';
    return (
        `${symbol} 내 위치: 평단 ${avgDisplay}, 현재가 ${currentDisplay}, ` +
        `수익률 ${returnSign}${model.returnPct.toFixed(1)}%, ` +
        `최근 범위의 ${model.rangePositionPct.toFixed(0)}% 지점`
    );
}

function outOfRangeNote(clamped: 'above' | 'below' | null): string | null {
    if (clamped === 'above') return '최근 고점보다 높은 곳';
    if (clamped === 'below') return '최근 저점보다 낮은 곳';
    return null;
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

const VIEWBOX_W = 280;
const VIEWBOX_H = 360;
const CENTER_X = VIEWBOX_W / 2;

const ISO_DX = 50; // 지붕 마름모 반폭(가로)
const ISO_DY = 25; // 지붕 마름모 반폭(세로, 2:1 비율 → dx의 절반)

const FLOOR_H = 30; // 층당 세로 픽셀 높이
const BAND_COUNT = 5;
const BUILDING_H = FLOOR_H * BAND_COUNT; // 150

const ROOF_BACK_Y = 70; // 지붕 마름모의 뒤쪽(가장 먼) 꼭짓점
const ROOF_EAVE_Y = ROOF_BACK_Y + ISO_DY; // 지붕 마름모의 좌/우 꼭짓점(95)
const ROOF_FRONT_Y = ROOF_BACK_Y + 2 * ISO_DY; // 지붕 마름모의 앞쪽(정면) 꼭짓점(120) — 건물의 정면 모서리 기준선

const GROUND_FRONT_Y = ROOF_FRONT_Y + BUILDING_H; // 정면 모서리 바닥(270)
const GROUND_EAVE_Y = ROOF_EAVE_Y + BUILDING_H; // 좌/우 모서리 바닥(245)

// 옥상 위(하늘)/지하 마커 배치 — avgClamped·currentClamped 'above'/'below' 대칭 처리.
const SKY_Y = ROOF_BACK_Y - 34;
const BASEMENT_Y = GROUND_FRONT_Y + 34;

const HIGH_LABEL_Y = ROOF_BACK_Y - 12;
const LOW_LABEL_Y = GROUND_FRONT_Y + 18;

/** avg/current가 이 값 미만 차이일 때 겹침을 막기 위해 마커를 좌우로 dodge한다. */
const DODGE_EPSILON = 0.04;
const DODGE_X_OFFSET = 11;
const MARKER_HALF = 6;
const LABEL_GAP = 12;

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

    const windowsLeft = WINDOW_T_STARTS.map(t => {
        const top1 = lerp(leftOuterTop, frontTop, t);
        const top2 = lerp(leftOuterTop, frontTop, t + WINDOW_T_WIDTH);
        const bottom1: Point = { x: top1.x, y: top1.y + WINDOW_Y_INSET };
        const bottom2: Point = { x: top2.x, y: top2.y + WINDOW_Y_INSET };
        return [
            { x: top1.x, y: top1.y + WINDOW_Y_INSET / 2 },
            { x: top2.x, y: top2.y + WINDOW_Y_INSET / 2 },
            bottom2,
            bottom1,
        ];
    });
    const windowsRight = WINDOW_T_STARTS.map(t => {
        const top1 = lerp(rightOuterTop, frontTop, t);
        const top2 = lerp(rightOuterTop, frontTop, t + WINDOW_T_WIDTH);
        const bottom1: Point = { x: top1.x, y: top1.y + WINDOW_Y_INSET };
        const bottom2: Point = { x: top2.x, y: top2.y + WINDOW_Y_INSET };
        return [
            { x: top1.x, y: top1.y + WINDOW_Y_INSET / 2 },
            { x: top2.x, y: top2.y + WINDOW_Y_INSET / 2 },
            bottom2,
            bottom1,
        ];
    });

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
}: PositionBuildingProps) {
    const avgDisplay = formatUsd(avg);
    const currentDisplay = formatUsd(current);
    const ariaLabel = buildAriaLabel(symbol, model, avgDisplay, currentDisplay);

    const avgNote = outOfRangeNote(model.avgClamped);
    const currentNote = outOfRangeNote(model.currentClamped);

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
            className={cn(
                'flex min-h-[280px] flex-col items-center gap-2',
                className
            )}
            data-testid="position-building"
        >
            <svg
                viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
                className="h-full w-full max-w-[280px]"
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
                    return (
                        <g
                            key={`${band.fromPct}-${band.toPct}`}
                            data-testid="building-floor"
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
                                y1={
                                    ROOF_EAVE_Y + (BAND_COUNT - 1 - i) * FLOOR_H
                                }
                                x2={CENTER_X}
                                y2={
                                    ROOF_FRONT_Y +
                                    (BAND_COUNT - 1 - i) * FLOOR_H
                                }
                                stroke="currentColor"
                                strokeWidth={0.75}
                                className="text-secondary-950/40"
                            />
                            <line
                                x1={CENTER_X}
                                y1={
                                    ROOF_FRONT_Y +
                                    (BAND_COUNT - 1 - i) * FLOOR_H
                                }
                                x2={CENTER_X + ISO_DX}
                                y2={
                                    ROOF_EAVE_Y + (BAND_COUNT - 1 - i) * FLOOR_H
                                }
                                stroke="currentColor"
                                strokeWidth={0.75}
                                className="text-secondary-950/40"
                            />
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
                    cy={GROUND_FRONT_Y + 6}
                    rx={ISO_DX + 14}
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
                    <tspan className="fill-secondary-400">★ 내 평단 </tspan>
                    <tspan className="fill-secondary-100">
                        {avgDisplaySvg}
                    </tspan>
                </text>
                {avgNote && (
                    <text
                        data-testid="avg-out-of-range-note"
                        x={CENTER_X - ISO_DX - LABEL_GAP}
                        y={avgY + 12}
                        textAnchor="end"
                        className="fill-secondary-400 text-[9px]"
                    >
                        {model.avgClamped === 'above' ? '☁ ' : '▽B1 '}
                        {avgNote}
                    </text>
                )}

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
                    <tspan className="fill-secondary-400">● 현재가 </tspan>
                    <tspan className="fill-secondary-100">
                        {currentDisplaySvg}
                    </tspan>
                </text>
                {currentNote && (
                    <text
                        data-testid="current-out-of-range-note"
                        x={CENTER_X + ISO_DX + LABEL_GAP}
                        y={currentY + 12}
                        textAnchor="start"
                        className="fill-secondary-400 text-[9px]"
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
        </div>
    );
}
