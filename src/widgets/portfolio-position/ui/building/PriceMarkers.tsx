/**
 * 빌딩 정면 모서리에 붙는 가격 마커 — ★평단(왼쪽 라벨)과 ●현재가(오른쪽 라벨), 각자의 층·범위 밖 안내.
 */
import {
    CENTER_X,
    ISO_DX,
    LABEL_GAP,
    MARKER_HALF,
    NOTE_Y_OFFSET,
} from '../../utils/buildingGeometry';

const STAR_INNER = MARKER_HALF * 0.35;
/** 8꼭짓점 별(★) — 마커 중심 기준. */
const STAR_POINTS = [
    [0, -MARKER_HALF],
    [STAR_INNER, -STAR_INNER],
    [MARKER_HALF, 0],
    [STAR_INNER, STAR_INNER],
    [0, MARKER_HALF],
    [-STAR_INNER, STAR_INNER],
    [-MARKER_HALF, 0],
    [-STAR_INNER, -STAR_INNER],
]
    .map(([x, y]) => `${x},${y}`)
    .join(' ');

const LABEL_CLASS = 'fill-current text-[10px] font-medium tabular-nums';
const NOTE_CLASS = 'fill-secondary-400 text-[10px]';

interface MarkerLabelProps {
    readonly prefix: string;
    readonly price: string;
}

function MarkerLabelText({ prefix, price }: MarkerLabelProps) {
    return (
        <>
            <tspan className="fill-secondary-400">{prefix}</tspan>
            <tspan className="fill-secondary-100">{price}</tspan>
        </>
    );
}

interface AvgMarkerProps extends MarkerLabelProps {
    readonly x: number;
    readonly y: number;
    /** 층 안내 — 범위 밖이면 방향 glyph가 앞에 붙은 메타포, 범위 안이면 "N층 · tier". */
    readonly floorNote: string;
}

/** ★평단 마커 — 라벨은 건물 왼쪽에 끝 정렬. 위치 서술만, 매수/매도 판단 언어는 쓰지 않는다. */
export function AvgMarker({ x, y, prefix, price, floorNote }: AvgMarkerProps) {
    const labelX = CENTER_X - ISO_DX - LABEL_GAP;
    return (
        <>
            <g data-testid="avg-marker" transform={`translate(${x} ${y})`}>
                <polygon
                    points={STAR_POINTS}
                    fill="currentColor"
                    className="text-secondary-100"
                />
            </g>
            <text
                x={labelX}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                className={LABEL_CLASS}
            >
                <MarkerLabelText prefix={prefix} price={price} />
            </text>
            <text
                data-testid="avg-floor-note"
                x={labelX}
                y={y + NOTE_Y_OFFSET}
                textAnchor="end"
                className={NOTE_CLASS}
            >
                {floorNote}
            </text>
        </>
    );
}

interface CurrentMarkerProps extends MarkerLabelProps {
    readonly x: number;
    readonly y: number;
    /** 마커 색 토큰(`currentMarkerClass`). */
    readonly toneClass: string;
    /** 범위 밖일 때만 — 방향 glyph가 앞에 붙은 안내. */
    readonly outOfRangeNote: string | null;
}

/** ●현재가 마커 — 라벨은 건물 오른쪽에 시작 정렬. */
export function CurrentMarker({
    x,
    y,
    prefix,
    price,
    toneClass,
    outOfRangeNote,
}: CurrentMarkerProps) {
    const labelX = CENTER_X + ISO_DX + LABEL_GAP;
    return (
        <>
            <g data-testid="current-marker" transform={`translate(${x} ${y})`}>
                <circle
                    r={MARKER_HALF * 0.7}
                    fill="currentColor"
                    className={toneClass}
                />
            </g>
            <text
                x={labelX}
                y={y}
                textAnchor="start"
                dominantBaseline="middle"
                className={LABEL_CLASS}
            >
                <MarkerLabelText prefix={prefix} price={price} />
            </text>
            {outOfRangeNote !== null && (
                <text
                    data-testid="current-out-of-range-note"
                    x={labelX}
                    y={y + NOTE_Y_OFFSET}
                    textAnchor="start"
                    className={NOTE_CLASS}
                >
                    {outOfRangeNote}
                </text>
            )}
        </>
    );
}
