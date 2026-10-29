import type { ReactElement } from 'react';
import type { DemoBar, DemoOverlay } from '@/views/guide/demos/types';
import { splitRuns, toPoints } from '@/views/guide/lib/chartLayout';
import {
    bandEdges,
    DEMO_MARKER_ARROW,
    MARKER_ARROW_HALF_BASE_RATIO,
    markerGeometry,
    profileRowHeight,
    type BandEdge,
    type DemoChartFrame,
    type MarkerGeometry,
} from '@/views/guide/lib/demoChartLayout';
import {
    ROLE_STROKE,
    SERIES_FILL,
    SERIES_STROKE,
    TONE_FILL,
} from '@/views/guide/ui/guideChartStyles';

type OverlayOf<K extends DemoOverlay['kind']> = Extract<
    DemoOverlay,
    { kind: K }
>;

interface ShapeProps<K extends DemoOverlay['kind']> {
    readonly overlay: OverlayOf<K>;
    readonly frame: DemoChartFrame;
}

/** 가격대별 거래량 막대가 차트 폭에서 차지하는 최대 비율. */
const PROFILE_MAX_WIDTH_RATIO = 0.3;
/** 거래량이 가장 많은 가격대(POC) 막대의 불투명도 — 다른 가격대보다 진하게 칠해 한눈에 띄게 한다. */
const PROFILE_POC_OPACITY = 0.55;
/** POC가 아닌 가격대 막대의 불투명도 — 뒤의 봉이 비치도록 옅게 칠한다. */
const PROFILE_ROW_OPACITY = 0.3;

/** 구간 채움 불투명도 — 구간 안의 봉이 가려지지 않게 옅게 칠한다. */
const ZONE_FILL_OPACITY = 0.14;
/** 구간 테두리 점선 — 실선인 추세선·띠 경계와 구분된다. */
const ZONE_DASH = '4 3';
/** 구간 테두리 굵기 — 채움만으로 경계가 흐린 것을 보완할 만큼만 얇게 둔다. */
const ZONE_STROKE_WIDTH = 0.9;
/** 구간 사각형의 최소 폭·높이(viewBox 단위) — 고가와 저가가 같아도 구간이 사라지지 않게 한다. */
const ZONE_MIN_SIZE = 1;

/** 띠 채움 불투명도 — 구간보다 살짝 옅게 칠해 겹쳐도 아래 봉이 비친다. */
const BAND_FILL_OPACITY = 0.13;
/** 띠 위·아래 경계선 굵기 — 시리즈 선(`SERIES_STROKE_WIDTH`)보다 가늘어 띠가 주 선을 덮지 않는다. */
const BAND_EDGE_STROKE_WIDTH = 1;

/** 수평선(지지·저항 등) 점선 — 구간 테두리보다 길게 끊어 둘을 구분한다. */
const LEVEL_DASH = '5 3';
/** 수평선 굵기 — 추세선(`LINE_STROKE_WIDTH`)보다 가늘어 둘이 겹쳐도 패턴 선이 앞서 보인다. */
const LEVEL_STROKE_WIDTH = 1.1;

/** 넥라인 점선 — 실선인 추세선과 구분한다. */
const NECKLINE_DASH = '6 3';
/** 추세선·넥라인 굵기 — 오버레이 중 가장 굵어 패턴의 뼈대가 먼저 보인다. */
const LINE_STROKE_WIDTH = 1.4;

/** 점 시리즈 반지름 상한(viewBox 단위) — 봉이 성겨도 점이 봉을 가리지 않게 한다. */
const DOT_MAX_RADIUS = 2.2;
/** 점 시리즈 반지름 하한(viewBox 단위) — 봉이 촘촘해도 점이 보이게 한다. */
const DOT_MIN_RADIUS = 1.3;
/** 점 반지름은 봉 간격의 이 비율이다(상·하한 안에서) — 이웃 점끼리 맞붙지 않는다. */
const DOT_PITCH_RATIO = 0.3;
/** 시리즈 선 굵기 — 띠 경계(`BAND_EDGE_STROKE_WIDTH`)보다 굵어 띠 안에서도 주 선이 묻히지 않는다. */
const SERIES_STROKE_WIDTH = 1.5;
/** 세 번째 색(`c`) 시리즈의 점선 — 색만으로 구분하기 어려운 화면에서도 선을 가를 수 있게 모양을 더한다. */
const TONE_C_DASH = '4 2';

function ZoneShape({ overlay, frame }: ShapeProps<'zone'>) {
    const x1 = frame.xOf(overlay.fromIndex) - frame.pitch / 2;
    const x2 = frame.xOf(overlay.toIndex) + frame.pitch / 2;
    const y1 = frame.yOf(overlay.high);
    const y2 = frame.yOf(overlay.low);
    return (
        <rect
            className="fill-primary-500 stroke-primary-400"
            fillOpacity={ZONE_FILL_OPACITY}
            height={Math.max(ZONE_MIN_SIZE, y2 - y1)}
            strokeDasharray={ZONE_DASH}
            strokeWidth={ZONE_STROKE_WIDTH}
            width={Math.max(ZONE_MIN_SIZE, x2 - x1)}
            x={x1}
            y={y1}
        />
    );
}

function BandShape({
    overlay,
    frame,
    edges,
}: ShapeProps<'band'> & { readonly edges: readonly BandEdge[] }) {
    const { xOf, yOf } = frame;
    const tone = overlay.tone ?? 'a';
    const top = edges.map(({ i, upper }) => ({ x: xOf(i), y: yOf(upper) }));
    const bottom = edges.map(({ i, lower }) => ({ x: xOf(i), y: yOf(lower) }));
    return (
        <g>
            <polygon
                className={SERIES_FILL[tone]}
                fillOpacity={BAND_FILL_OPACITY}
                points={toPoints([...top, ...bottom.toReversed()])}
            />
            {[overlay.upper, overlay.lower].map((edge, edgeIndex) =>
                splitRuns(edge, xOf, yOf).map((run, runIndex) => (
                    <polyline
                        key={`${edgeIndex}-${runIndex}`}
                        className={SERIES_STROKE[tone]}
                        fill="none"
                        points={toPoints(run)}
                        strokeWidth={BAND_EDGE_STROKE_WIDTH}
                    />
                ))
            )}
        </g>
    );
}

function ProfileShape({ overlay, frame }: ShapeProps<'profile'>) {
    const maxVolume = Math.max(...overlay.rows.map(row => row.volume), 1);
    const rowHeight = profileRowHeight(overlay.rows, frame.yOf);
    return (
        <g>
            {overlay.rows.map(row => {
                const width =
                    (row.volume / maxVolume) *
                    frame.plotWidth *
                    PROFILE_MAX_WIDTH_RATIO;
                // 거래량이 가장 많은 가격대(POC)만 강조색이다.
                const isPoc = row.volume === maxVolume;
                return (
                    <rect
                        key={row.price}
                        className={
                            isPoc ? 'fill-primary-400' : 'fill-secondary-400'
                        }
                        fillOpacity={
                            isPoc ? PROFILE_POC_OPACITY : PROFILE_ROW_OPACITY
                        }
                        height={rowHeight}
                        width={width}
                        x={frame.plot.right - width}
                        y={frame.yOf(row.price) - rowHeight / 2}
                    />
                );
            })}
        </g>
    );
}

function LevelShape({ overlay, frame }: ShapeProps<'level'>) {
    const y = frame.yOf(overlay.price);
    return (
        <line
            className={ROLE_STROKE[overlay.role ?? 'neutral']}
            strokeDasharray={LEVEL_DASH}
            strokeWidth={LEVEL_STROKE_WIDTH}
            x1={frame.xOf(overlay.fromIndex ?? 0) - frame.pitch / 2}
            x2={frame.plot.right}
            y1={y}
            y2={y}
        />
    );
}

function LineShape({ overlay, frame }: ShapeProps<'line'>) {
    return (
        <line
            className={ROLE_STROKE[overlay.role]}
            strokeDasharray={
                overlay.role === 'neckline' ? NECKLINE_DASH : undefined
            }
            strokeLinecap="round"
            strokeWidth={LINE_STROKE_WIDTH}
            x1={frame.xOf(overlay.from.i)}
            x2={frame.xOf(overlay.to.i)}
            y1={frame.yOf(overlay.from.price)}
            y2={frame.yOf(overlay.to.price)}
        />
    );
}

function SeriesShape({ overlay, frame }: ShapeProps<'series'>) {
    const tone = overlay.tone ?? 'a';
    const runs = splitRuns(overlay.values, frame.xOf, frame.yOf);
    if (overlay.style === 'dots') {
        const radius = Math.min(
            DOT_MAX_RADIUS,
            Math.max(DOT_MIN_RADIUS, frame.pitch * DOT_PITCH_RATIO)
        );
        return (
            <g>
                {runs.flat().map(point => (
                    <circle
                        key={`${point.x}`}
                        className={SERIES_FILL[tone]}
                        cx={point.x}
                        cy={point.y}
                        r={radius}
                    />
                ))}
            </g>
        );
    }
    return (
        <g>
            {runs
                .map(run => toPoints(run))
                .map(points => (
                    <polyline
                        // 끊긴 구간들은 서로 다른 봉 칸을 덮어 좌표 문자열이 겹치지 않는다.
                        key={points}
                        className={SERIES_STROKE[tone]}
                        fill="none"
                        points={points}
                        strokeDasharray={tone === 'c' ? TONE_C_DASH : undefined}
                        strokeLinejoin="round"
                        strokeWidth={SERIES_STROKE_WIDTH}
                    />
                ))}
        </g>
    );
}

function MarkerShape({
    overlay,
    marker,
}: {
    readonly overlay: OverlayOf<'marker'>;
    readonly marker: MarkerGeometry;
}) {
    const { x, tipY, baseY } = marker;
    const half = DEMO_MARKER_ARROW * MARKER_ARROW_HALF_BASE_RATIO;
    return (
        <polygon
            className={TONE_FILL[overlay.tone]}
            points={`${x},${tipY} ${x - half},${baseY} ${x + half},${baseY}`}
        />
    );
}

/**
 * 오버레이 하나의 도형. 그릴 것이 없으면(유효 칸이 모자란 띠, 없는 봉을 가리키는 표식) null이다 —
 * 판단에 쓴 띠 칸·표식 좌표를 그대로 도형에 넘겨 같은 계산과 검사를 두 번 하지 않는다.
 */
function shapeOf(
    overlay: DemoOverlay,
    frame: DemoChartFrame,
    bars: readonly DemoBar[]
): ReactElement | null {
    switch (overlay.kind) {
        case 'zone':
            return <ZoneShape overlay={overlay} frame={frame} />;
        case 'band': {
            const edges = bandEdges(overlay);
            return edges === null ? null : (
                <BandShape edges={edges} frame={frame} overlay={overlay} />
            );
        }
        case 'profile':
            return <ProfileShape overlay={overlay} frame={frame} />;
        case 'level':
            return <LevelShape overlay={overlay} frame={frame} />;
        case 'line':
            return <LineShape overlay={overlay} frame={frame} />;
        case 'series':
            return <SeriesShape overlay={overlay} frame={frame} />;
        case 'marker': {
            const marker = markerGeometry(overlay, bars, frame);
            return marker === null ? null : (
                <MarkerShape marker={marker} overlay={overlay} />
            );
        }
    }
}

interface DemoOverlayShapeProps {
    readonly overlay: DemoOverlay;
    readonly frame: DemoChartFrame;
    readonly bars: readonly DemoBar[];
}

/**
 * 데모 차트 오버레이(구간·띠·가격대별 거래량·수평선·추세선·시리즈·표식) 하나의 도형을 `<g>`로 감싸 그린다.
 * 라벨은 여기서 그리지 않는다 — 라벨은 봉·다른 라벨을 피해 자리를 잡아야 해서 `DemoTextLabel`이 맨 위 층에 따로 그린다.
 */
export function DemoOverlayShape({
    overlay,
    frame,
    bars,
}: DemoOverlayShapeProps) {
    const shape = shapeOf(overlay, frame, bars);
    // 그릴 것이 없으면 감싸는 `<g>`도 남기지 않는다.
    return shape === null ? null : <g>{shape}</g>;
}
