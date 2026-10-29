/** 데모 차트 오버레이(구간·띠·가격대별 거래량·수평선·추세선·시리즈·표식)의 도형. 라벨은 `DemoTextLabel`이 그린다. */
import type { ReactNode } from 'react';
import type { DemoBar, DemoOverlay } from '@/views/guide/demos/types';
import { splitRuns, toPoints } from '@/views/guide/lib/chartLayout';
import {
    bandEdges,
    DEMO_MARKER_ARROW,
    markerGeometry,
    profileRowHeight,
    type DemoChartFrame,
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

function ZoneShape({ overlay, frame }: ShapeProps<'zone'>) {
    const x1 = frame.xOf(overlay.fromIndex) - frame.pitch / 2;
    const x2 = frame.xOf(overlay.toIndex) + frame.pitch / 2;
    const y1 = frame.yOf(overlay.high);
    const y2 = frame.yOf(overlay.low);
    return (
        <rect
            className="fill-primary-500 stroke-primary-400"
            fillOpacity={0.14}
            height={Math.max(1, y2 - y1)}
            strokeDasharray="4 3"
            strokeWidth={0.9}
            width={Math.max(1, x2 - x1)}
            x={x1}
            y={y1}
        />
    );
}

function BandShape({ overlay, frame }: ShapeProps<'band'>) {
    const { xOf, yOf } = frame;
    const tone = overlay.tone ?? 'a';
    const edges = bandEdges(overlay);
    if (edges.length < 2) return null;
    const top = edges.map(({ i, upper }) => ({ x: xOf(i), y: yOf(upper) }));
    const bottom = edges.map(({ i, lower }) => ({ x: xOf(i), y: yOf(lower) }));
    return (
        <g>
            <polygon
                className={SERIES_FILL[tone]}
                fillOpacity={0.13}
                points={toPoints([...top, ...bottom.toReversed()])}
            />
            {[overlay.upper, overlay.lower].map((edge, edgeIndex) =>
                splitRuns(edge, xOf, yOf).map((run, runIndex) => (
                    <polyline
                        key={`${edgeIndex}-${runIndex}`}
                        className={SERIES_STROKE[tone]}
                        fill="none"
                        points={toPoints(run)}
                        strokeWidth={1}
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
                        fillOpacity={isPoc ? 0.55 : 0.3}
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
            strokeDasharray="5 3"
            strokeWidth={1.1}
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
            strokeDasharray={overlay.role === 'neckline' ? '6 3' : undefined}
            strokeLinecap="round"
            strokeWidth={1.4}
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
        const radius = Math.min(2.2, Math.max(1.3, frame.pitch * 0.3));
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
            {runs.map((run, runIndex) => (
                <polyline
                    // 한 선의 끊긴 구간들이다. 순서가 곧 위치라 인덱스 외의 정체성이 없다.
                    // react-doctor-disable-next-line react-doctor/no-array-index-as-key
                    key={runIndex}
                    className={SERIES_STROKE[tone]}
                    fill="none"
                    points={toPoints(run)}
                    strokeDasharray={tone === 'c' ? '4 2' : undefined}
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                />
            ))}
        </g>
    );
}

function MarkerShape({
    overlay,
    frame,
    bars,
}: ShapeProps<'marker'> & { readonly bars: readonly DemoBar[] }) {
    const marker = markerGeometry(overlay, bars, frame);
    if (marker === null) return null;
    const { x, tipY, baseY } = marker;
    const half = DEMO_MARKER_ARROW * 0.75;
    return (
        <polygon
            className={TONE_FILL[overlay.tone]}
            points={`${x},${tipY} ${x - half},${baseY} ${x + half},${baseY}`}
        />
    );
}

function shapeOf(
    overlay: DemoOverlay,
    frame: DemoChartFrame,
    bars: readonly DemoBar[]
): ReactNode {
    switch (overlay.kind) {
        case 'zone':
            return <ZoneShape overlay={overlay} frame={frame} />;
        case 'band':
            return <BandShape overlay={overlay} frame={frame} />;
        case 'profile':
            return <ProfileShape overlay={overlay} frame={frame} />;
        case 'level':
            return <LevelShape overlay={overlay} frame={frame} />;
        case 'line':
            return <LineShape overlay={overlay} frame={frame} />;
        case 'series':
            return <SeriesShape overlay={overlay} frame={frame} />;
        case 'marker':
            return <MarkerShape overlay={overlay} frame={frame} bars={bars} />;
    }
}

/** 그릴 수 없는 오버레이(유효 칸이 모자란 띠, 없는 봉을 가리키는 표식)는 감싸는 `<g>`도 남기지 않는다. */
function isDrawable(overlay: DemoOverlay, bars: readonly DemoBar[]): boolean {
    switch (overlay.kind) {
        case 'band':
            return bandEdges(overlay).length >= 2;
        case 'marker':
            return bars[overlay.i] !== undefined;
        default:
            return true;
    }
}

interface DemoOverlayShapeProps {
    readonly overlay: DemoOverlay;
    readonly frame: DemoChartFrame;
    readonly bars: readonly DemoBar[];
}

/** 오버레이 하나의 도형을 `<g>`로 감싸 그린다. */
export function DemoOverlayShape({
    overlay,
    frame,
    bars,
}: DemoOverlayShapeProps) {
    if (!isDrawable(overlay, bars)) return null;
    return <g>{shapeOf(overlay, frame, bars)}</g>;
}
