import { useId } from 'react';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import type {
    DemoOverlay,
    DemoSeriesTone,
    GuideDemo,
} from '@/views/guide/demos/types';
import {
    estimateLabelWidth,
    formatTick,
    linearScale,
    niceTicks,
    placeLabel,
    splitRuns,
    tickStep,
    toPoints,
    type LabelBox,
} from '@/views/guide/lib/chartLayout';
import { GuideDemoPane, type PaneFrame } from '@/views/guide/ui/GuideDemoPane';
import {
    LABEL_HALO,
    ROLE_STROKE,
    ROLE_TEXT,
    SERIES_FILL,
    SERIES_STROKE,
    SERIES_TEXT,
    TONE_FILL,
    TONE_STROKE,
    TONE_TEXT,
} from '@/views/guide/ui/guideChartStyles';

interface GuideDemoChartProps {
    demo: GuideDemo;
    title: string;
    caption: string | null;
}

/** viewBox 단위. 모바일(≈330px)에서 0.75배, 데스크톱(최대 36rem)에서 1.3배로 그려진다. */
const WIDTH = 440;
const MARGIN_LEFT = 6;
const MARGIN_RIGHT = 46;
const MARGIN_TOP = 14;
const MARGIN_BOTTOM = 8;
const PRICE_HEIGHT = 230;
const PANE_HEIGHT = 78;
const PANE_GAP = 8;
const FONT = 12;
const BODY_RATIO = 0.62;
const MAX_BODY = 20;
const MIN_BODY = 2;
const PRICE_PAD = 0.07;
const FAR_SERIES_SPAN = 0.35;
const ARROW = 5;

const TEXT_HALO_PROPS = {
    paintOrder: 'stroke',
    strokeLinejoin: 'round',
    strokeWidth: 3,
} as const;

function isNum(value: number | null | undefined): value is number {
    return value !== null && value !== undefined && Number.isFinite(value);
}

function priceDomain(demo: GuideDemo): [number, number] {
    let min = Infinity;
    let max = -Infinity;
    for (const bar of demo.bars) {
        min = Math.min(min, bar.low);
        max = Math.max(max, bar.high);
    }
    const barSpan = max - min || 1;
    const extend = (value: number | null | undefined, strict: boolean) => {
        if (!isNum(value)) return;
        if (
            !strict &&
            (value < min - barSpan * FAR_SERIES_SPAN ||
                value > max + barSpan * FAR_SERIES_SPAN)
        )
            return;
        min = Math.min(min, value);
        max = Math.max(max, value);
    };
    for (const overlay of demo.overlays ?? []) {
        switch (overlay.kind) {
            case 'line':
                extend(overlay.from.price, true);
                extend(overlay.to.price, true);
                break;
            case 'level':
                extend(overlay.price, true);
                break;
            case 'zone':
                extend(overlay.low, true);
                extend(overlay.high, true);
                break;
            case 'series':
                overlay.values.forEach(value => extend(value, false));
                break;
            case 'band':
                overlay.upper.forEach(value => extend(value, false));
                overlay.lower.forEach(value => extend(value, false));
                break;
            case 'profile':
                overlay.rows.forEach(row => extend(row.price, true));
                break;
            case 'marker':
                break;
        }
    }
    const pad = (max - min || 1) * PRICE_PAD;
    return [min - pad, max + pad];
}

function describe(demo: GuideDemo): string {
    const panes = demo.panes?.map(pane => pane.label).join(', ');
    return panes === undefined || panes === ''
        ? `${demo.bars.length} candlesticks`
        : `${demo.bars.length} candlesticks with ${panes}`;
}

function TextLabel({
    box,
    anchor,
    className,
    text,
    bold = true,
    size = FONT,
}: {
    box: LabelBox;
    anchor: 'start' | 'middle' | 'end';
    className: string;
    text: string;
    bold?: boolean;
    size?: number;
}) {
    const x =
        anchor === 'start'
            ? box.x + 2
            : anchor === 'end'
              ? box.x + box.width - 2
              : box.x + box.width / 2;
    return (
        <text
            className={cn(className, LABEL_HALO)}
            dominantBaseline="central"
            fontSize={size}
            fontWeight={bold ? 600 : 400}
            textAnchor={anchor}
            x={x}
            y={box.y + box.height / 2}
            {...TEXT_HALO_PROPS}
        >
            {text}
        </text>
    );
}

/**
 * 가이드 항목의 설명용 데모 차트. 순수 SVG를 서버에서 그리므로 클라이언트 JS가 없고,
 * 색은 전부 디자인 토큰이라 다크/라이트를 따른다.
 */
export function GuideDemoChart({ demo, title, caption }: GuideDemoChartProps) {
    const uid = useId();
    const titleId = `${uid}-title`;
    const descId = `${uid}-desc`;
    const clipId = `${uid}-clip`;
    const panes = demo.panes ?? [];
    const barCount = demo.bars.length;

    const plotLeft = MARGIN_LEFT;
    const plotRight = WIDTH - MARGIN_RIGHT;
    const plotWidth = plotRight - plotLeft;
    const pitch = plotWidth / Math.max(1, barCount);
    const xOf = (index: number) => plotLeft + (index + 0.5) * pitch;

    const priceTop = MARGIN_TOP;
    const priceBottom = priceTop + PRICE_HEIGHT;
    const [min, max] = priceDomain(demo);
    const yOf = linearScale(min, max, priceBottom, priceTop);
    const ticks = niceTicks(min, max, 5);
    const step = tickStep(ticks);

    const paneFrames: { top: number; height: number }[] = [];
    let cursor = priceBottom + PANE_GAP;
    for (const pane of panes) {
        const height = pane.height ?? PANE_HEIGHT;
        paneFrames.push({ top: cursor, height });
        cursor += height + PANE_GAP;
    }
    const totalHeight =
        (panes.length > 0 ? cursor - PANE_GAP : priceBottom) + MARGIN_BOTTOM;

    const bodyWidth = Math.min(
        MAX_BODY,
        Math.max(MIN_BODY, pitch * BODY_RATIO)
    );
    const placed: LabelBox[] = [];
    const bounds = { top: priceTop, bottom: priceBottom };
    const box = (
        text: string,
        x: number,
        y: number,
        anchor: 'start' | 'middle' | 'end',
        size = FONT
    ): LabelBox => {
        const width = estimateLabelWidth(text, size);
        const height = size + 3;
        const left =
            anchor === 'start'
                ? x
                : anchor === 'end'
                  ? x - width
                  : x - width / 2;
        return {
            x: Math.min(Math.max(left, plotLeft), plotRight - width),
            y: y - height / 2,
            width,
            height,
        };
    };

    const overlays = demo.overlays ?? [];
    const drawn: { key: string; node: React.ReactNode }[] = [];
    const labels: React.ReactNode[] = [];

    overlays.forEach((overlay: DemoOverlay, index) => {
        const key = `${overlay.kind}-${index}`;
        switch (overlay.kind) {
            case 'zone': {
                const x1 = xOf(overlay.fromIndex) - pitch / 2;
                const x2 = xOf(overlay.toIndex) + pitch / 2;
                const y1 = yOf(overlay.high);
                const y2 = yOf(overlay.low);
                drawn.push({
                    key,
                    node: (
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
                    ),
                });
                if (overlay.label !== undefined) {
                    const b = placeLabel(
                        placed,
                        box(overlay.label, x1 + 2, y1 + 8, 'start'),
                        1,
                        bounds
                    );
                    labels.push(
                        <TextLabel
                            key={key}
                            anchor="start"
                            box={b}
                            className="fill-primary-300"
                            text={overlay.label}
                        />
                    );
                }
                break;
            }
            case 'band': {
                const tone: DemoSeriesTone = overlay.tone ?? 'a';
                const top: { x: number; y: number }[] = [];
                const bottom: { x: number; y: number }[] = [];
                overlay.upper.forEach((upper, i) => {
                    const lower = overlay.lower[i];
                    if (!isNum(upper) || !isNum(lower)) return;
                    top.push({ x: xOf(i), y: yOf(upper) });
                    bottom.push({ x: xOf(i), y: yOf(lower) });
                });
                if (top.length < 2) break;
                drawn.push({
                    key,
                    node: (
                        <g>
                            <polygon
                                className={SERIES_FILL[tone]}
                                fillOpacity={0.13}
                                points={toPoints([...top, ...bottom.reverse()])}
                            />
                            {[overlay.upper, overlay.lower].map(
                                (edge, edgeIndex) =>
                                    splitRuns(edge, xOf, yOf).map(
                                        (run, runIndex) => (
                                            <polyline
                                                key={`${edgeIndex}-${runIndex}`}
                                                className={SERIES_STROKE[tone]}
                                                fill="none"
                                                points={toPoints(run)}
                                                strokeWidth={1}
                                            />
                                        )
                                    )
                            )}
                        </g>
                    ),
                });
                if (overlay.label !== '') {
                    const upperIdx = overlay.upper.reduce<number>(
                        (acc, v, i) => (isNum(v) ? i : acc),
                        -1
                    );
                    const upperValue = overlay.upper[upperIdx];
                    if (isNum(upperValue)) {
                        const b = placeLabel(
                            placed,
                            box(
                                overlay.label,
                                xOf(upperIdx),
                                yOf(upperValue) - 8,
                                'end'
                            ),
                            -1,
                            bounds
                        );
                        labels.push(
                            <TextLabel
                                key={key}
                                anchor="end"
                                box={b}
                                className={SERIES_TEXT[tone]}
                                text={overlay.label}
                            />
                        );
                    }
                }
                break;
            }
            case 'profile': {
                const maxVolume = Math.max(
                    ...overlay.rows.map(row => row.volume),
                    1
                );
                const prices = overlay.rows
                    .map(row => row.price)
                    .sort((a, b) => a - b);
                let gap = Infinity;
                for (let i = 1; i < prices.length; i++)
                    gap = Math.min(gap, prices[i] - prices[i - 1]);
                const rowHeight = Number.isFinite(gap)
                    ? Math.max(2, Math.abs(yOf(0) - yOf(gap)) - 1)
                    : 4;
                drawn.push({
                    key,
                    node: (
                        <g>
                            {overlay.rows.map(row => {
                                const width =
                                    (row.volume / maxVolume) * plotWidth * 0.3;
                                const isPoc = row.volume === maxVolume;
                                return (
                                    <rect
                                        key={row.price}
                                        className={
                                            isPoc
                                                ? 'fill-primary-400'
                                                : 'fill-secondary-400'
                                        }
                                        fillOpacity={isPoc ? 0.55 : 0.3}
                                        height={rowHeight}
                                        width={width}
                                        x={plotRight - width}
                                        y={yOf(row.price) - rowHeight / 2}
                                    />
                                );
                            })}
                        </g>
                    ),
                });
                break;
            }
            case 'level': {
                const role = overlay.role ?? 'neutral';
                const x1 = xOf(overlay.fromIndex ?? 0) - pitch / 2;
                const y = yOf(overlay.price);
                drawn.push({
                    key,
                    node: (
                        <line
                            className={ROLE_STROKE[role]}
                            strokeDasharray="5 3"
                            strokeWidth={1.1}
                            x1={x1}
                            x2={plotRight}
                            y1={y}
                            y2={y}
                        />
                    ),
                });
                const b = placeLabel(
                    placed,
                    box(overlay.label, plotRight - 2, y - 8, 'end'),
                    -1,
                    bounds
                );
                labels.push(
                    <TextLabel
                        key={key}
                        anchor="end"
                        box={b}
                        className={ROLE_TEXT[role]}
                        text={overlay.label}
                    />
                );
                break;
            }
            case 'line': {
                const x1 = xOf(overlay.from.i);
                const x2 = xOf(overlay.to.i);
                const y1 = yOf(overlay.from.price);
                const y2 = yOf(overlay.to.price);
                drawn.push({
                    key,
                    node: (
                        <line
                            className={ROLE_STROKE[overlay.role]}
                            strokeDasharray={
                                overlay.role === 'neckline' ? '6 3' : undefined
                            }
                            strokeLinecap="round"
                            strokeWidth={1.4}
                            x1={x1}
                            x2={x2}
                            y1={y1}
                            y2={y2}
                        />
                    ),
                });
                if (overlay.label !== undefined) {
                    const b = placeLabel(
                        placed,
                        box(overlay.label, x2, y2 - 9, 'end'),
                        -1,
                        bounds
                    );
                    labels.push(
                        <TextLabel
                            key={key}
                            anchor="end"
                            box={b}
                            className={ROLE_TEXT[overlay.role]}
                            text={overlay.label}
                        />
                    );
                }
                break;
            }
            case 'series': {
                const tone: DemoSeriesTone = overlay.tone ?? 'a';
                const runs = splitRuns(overlay.values, xOf, yOf);
                drawn.push({
                    key,
                    node:
                        overlay.style === 'dots' ? (
                            <g>
                                {runs.flat().map(point => (
                                    <circle
                                        key={`${point.x}`}
                                        className={SERIES_FILL[tone]}
                                        cx={point.x}
                                        cy={point.y}
                                        r={Math.min(
                                            2.2,
                                            Math.max(1.3, pitch * 0.3)
                                        )}
                                    />
                                ))}
                            </g>
                        ) : (
                            <g>
                                {runs.map((run, runIndex) => (
                                    <polyline
                                        key={runIndex}
                                        className={SERIES_STROKE[tone]}
                                        fill="none"
                                        points={toPoints(run)}
                                        strokeDasharray={
                                            tone === 'c' ? '4 2' : undefined
                                        }
                                        strokeLinejoin="round"
                                        strokeWidth={1.5}
                                    />
                                ))}
                            </g>
                        ),
                });
                const lastRun = runs[runs.length - 1];
                const lastPoint = lastRun?.[lastRun.length - 1];
                if (overlay.label !== '' && lastPoint !== undefined) {
                    const b = placeLabel(
                        placed,
                        box(overlay.label, lastPoint.x, lastPoint.y - 9, 'end'),
                        -1,
                        bounds
                    );
                    labels.push(
                        <TextLabel
                            key={key}
                            anchor="end"
                            box={b}
                            className={SERIES_TEXT[tone]}
                            text={overlay.label}
                        />
                    );
                }
                break;
            }
            case 'marker': {
                const bar = demo.bars[overlay.i];
                if (bar === undefined) break;
                const x = xOf(overlay.i);
                const above = overlay.position === 'above';
                const tipY = above ? yOf(bar.high) - 3 : yOf(bar.low) + 3;
                const baseY = above ? tipY - ARROW * 1.4 : tipY + ARROW * 1.4;
                drawn.push({
                    key,
                    node: (
                        <polygon
                            className={TONE_FILL[overlay.tone]}
                            points={`${x},${tipY} ${x - ARROW * 0.75},${baseY} ${x + ARROW * 0.75},${baseY}`}
                        />
                    ),
                });
                const labelY = above
                    ? baseY - FONT * 0.65
                    : baseY + FONT * 0.65;
                const b = placeLabel(
                    placed,
                    box(overlay.label, x, labelY, 'middle'),
                    above ? -1 : 1,
                    bounds
                );
                labels.push(
                    <TextLabel
                        key={key}
                        anchor="middle"
                        box={b}
                        className={TONE_TEXT[overlay.tone]}
                        text={overlay.label}
                    />
                );
                break;
            }
        }
    });

    const paneNodes = panes.map((pane, index) => {
        const frame: PaneFrame = {
            top: paneFrames[index].top,
            height: paneFrames[index].height,
            left: plotLeft,
            right: plotRight,
            xOf,
            pitch,
            barCount,
        };
        return (
            <GuideDemoPane
                key={pane.label}
                frame={frame}
                labelFontSize={FONT}
                pane={pane}
            />
        );
    });

    return (
        <figure
            className={cn(
                SURFACE_CARD,
                'mx-auto w-full max-w-xl overflow-hidden'
            )}
        >
            <svg
                aria-labelledby={`${titleId} ${descId}`}
                className="block h-auto w-full"
                role="img"
                viewBox={`0 0 ${WIDTH} ${totalHeight}`}
            >
                <title id={titleId}>{title}</title>
                <desc id={descId}>{caption ?? describe(demo)}</desc>
                <defs>
                    <clipPath id={clipId}>
                        <rect
                            height={PRICE_HEIGHT}
                            width={plotWidth}
                            x={plotLeft}
                            y={priceTop}
                        />
                    </clipPath>
                </defs>
                {demo.highlight !== undefined && (
                    <rect
                        className="fill-primary-500"
                        fillOpacity={0.09}
                        height={totalHeight - MARGIN_TOP - MARGIN_BOTTOM}
                        width={
                            (demo.highlight.toIndex -
                                demo.highlight.fromIndex +
                                1) *
                            pitch
                        }
                        x={plotLeft + demo.highlight.fromIndex * pitch}
                        y={MARGIN_TOP}
                    />
                )}
                {ticks.map(tick => (
                    <g key={tick}>
                        <line
                            className="stroke-secondary-700"
                            strokeWidth={0.75}
                            x1={plotLeft}
                            x2={plotRight}
                            y1={yOf(tick)}
                            y2={yOf(tick)}
                        />
                        <text
                            className="fill-secondary-400"
                            dominantBaseline="central"
                            fontSize={FONT - 1}
                            x={plotRight + 4}
                            y={yOf(tick)}
                        >
                            {formatTick(tick, step)}
                        </text>
                    </g>
                ))}
                <g clipPath={`url(#${clipId})`}>
                    {drawn
                        .filter(item => !item.key.startsWith('marker'))
                        .map(item => (
                            <g key={item.key}>{item.node}</g>
                        ))}
                    {demo.bars.map((bar, index) => {
                        const tone =
                            bar.tone ??
                            (bar.close >= bar.open ? 'bull' : 'bear');
                        const x = xOf(index);
                        const top = yOf(Math.max(bar.open, bar.close));
                        const bottom = yOf(Math.min(bar.open, bar.close));
                        return (
                            <g key={bar.time}>
                                <line
                                    className={TONE_STROKE[tone]}
                                    shapeRendering="crispEdges"
                                    strokeWidth={Math.min(
                                        1.4,
                                        Math.max(0.9, bodyWidth * 0.12)
                                    )}
                                    x1={x}
                                    x2={x}
                                    y1={yOf(bar.high)}
                                    y2={yOf(bar.low)}
                                />
                                <rect
                                    className={TONE_FILL[tone]}
                                    height={Math.max(1.2, bottom - top)}
                                    width={bodyWidth}
                                    x={x - bodyWidth / 2}
                                    y={top}
                                />
                            </g>
                        );
                    })}
                    {drawn
                        .filter(item => item.key.startsWith('marker'))
                        .map(item => (
                            <g key={item.key}>{item.node}</g>
                        ))}
                </g>
                {labels}
                {paneNodes}
            </svg>
            {caption !== null && (
                <figcaption className="px-3 pt-1 pb-3 text-sm leading-relaxed text-secondary-300">
                    {caption}
                </figcaption>
            )}
        </figure>
    );
}
