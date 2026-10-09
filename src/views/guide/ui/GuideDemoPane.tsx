import {
    formatCompact,
    formatTick,
    linearScale,
    niceTicks,
    splitRuns,
    tickStep,
    toPoints,
} from '@/views/guide/lib/chartLayout';
import type { DemoPane } from '@/views/guide/demos/types';
import {
    LABEL_HALO,
    SERIES_STROKE,
    SERIES_TEXT,
    TONE_FILL,
} from '@/views/guide/ui/guideChartStyles';

export interface PaneFrame {
    top: number;
    height: number;
    left: number;
    right: number;
    /** 봉 인덱스 → x 좌표 */
    xOf: (index: number) => number;
    pitch: number;
    barCount: number;
}

interface GuideDemoPaneProps {
    pane: DemoPane;
    frame: PaneFrame;
    labelFontSize: number;
}

const PANE_PAD_RATIO = 0.12;
const LEGEND_GAP = 10;
const LABEL_CHAR_WIDTH = 0.6;

function paneDomain(pane: DemoPane): [number, number] {
    if (pane.range !== undefined) return [pane.range[0], pane.range[1]];
    const values: number[] = [];
    for (const line of pane.lines ?? []) {
        for (const value of line.values) {
            if (value !== null && Number.isFinite(value)) values.push(value);
        }
    }
    for (const value of pane.histogram ?? []) {
        if (value !== null && Number.isFinite(value)) values.push(value);
    }
    for (const level of pane.levels ?? []) values.push(level.value);
    if (pane.histogram !== undefined) values.push(0);
    if (values.length === 0) return [0, 1];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = (max - min || Math.abs(max) || 1) * PANE_PAD_RATIO;
    return [min - pad, max + pad];
}

const tickText = (value: number, step: number): string =>
    step >= 1000 ? formatCompact(value) : formatTick(value, step);

/** 가격 차트 아래에 붙는 보조 패널 (RSI·MACD·거래량 등). x축은 가격 차트와 공유한다. */
export function GuideDemoPane({
    pane,
    frame,
    labelFontSize,
}: GuideDemoPaneProps) {
    const [min, max] = paneDomain(pane);
    const innerTop = frame.top + 4;
    const innerBottom = frame.top + frame.height - 4;
    const yOf = linearScale(min, max, innerBottom, innerTop);
    const levelValues = (pane.levels ?? []).map(level => level.value);
    const ticks = niceTicks(min, max, 3).filter(
        tick => !levelValues.some(v => Math.abs(yOf(v) - yOf(tick)) < 9)
    );
    const step = tickStep(niceTicks(min, max, 3));
    const baseline = min <= 0 && max >= 0 ? yOf(0) : innerBottom;
    const barWidth = Math.max(1.2, frame.pitch * 0.7);
    const legendLines = (pane.lines ?? []).filter(line => line.label !== '');
    const legendStart =
        frame.left +
        4 +
        pane.label.length * labelFontSize * LABEL_CHAR_WIDTH +
        LEGEND_GAP;
    const legendXs = legendLines.reduce<number[]>((xs, line, index) => {
        const prev = legendLines[index - 1];
        const last = xs[index - 1];
        xs.push(
            prev === undefined
                ? legendStart
                : last +
                      prev.label.length * labelFontSize * LABEL_CHAR_WIDTH +
                      LEGEND_GAP
        );
        return xs;
    }, []);

    return (
        <g>
            <rect
                className="fill-none stroke-secondary-700"
                height={frame.height}
                strokeWidth={0.75}
                width={frame.right - frame.left}
                x={frame.left}
                y={frame.top}
            />
            {pane.histogram?.map((value, index) => {
                if (value === null || !Number.isFinite(value)) return null;
                const y = yOf(value);
                const tone =
                    pane.histogramTones?.[index] ??
                    (value >= 0 ? 'bull' : 'bear');
                return (
                    <rect
                        key={index}
                        className={TONE_FILL[tone]}
                        height={Math.max(0.8, Math.abs(baseline - y))}
                        width={barWidth}
                        x={frame.xOf(index) - barWidth / 2}
                        y={Math.min(y, baseline)}
                    />
                );
            })}
            {(pane.levels ?? []).map(level => (
                <g key={`level-${level.value}`}>
                    <line
                        className="stroke-secondary-500"
                        strokeDasharray="3 3"
                        strokeWidth={0.75}
                        x1={frame.left}
                        x2={frame.right}
                        y1={yOf(level.value)}
                        y2={yOf(level.value)}
                    />
                    <text
                        className="fill-secondary-400"
                        dominantBaseline="middle"
                        fontSize={labelFontSize - 1}
                        x={frame.right + 4}
                        y={yOf(level.value)}
                    >
                        {level.label ?? tickText(level.value, step)}
                    </text>
                </g>
            ))}
            {ticks.map(tick => (
                <text
                    key={`tick-${tick}`}
                    className="fill-secondary-400"
                    dominantBaseline="middle"
                    fontSize={labelFontSize - 1}
                    x={frame.right + 4}
                    y={yOf(tick)}
                >
                    {formatTick(tick, step)}
                </text>
            ))}
            {(pane.lines ?? []).map(line =>
                splitRuns(line.values, frame.xOf, yOf).map((run, runIndex) => (
                    <polyline
                        key={`${line.label}-${runIndex}`}
                        className={SERIES_STROKE[line.tone ?? 'a']}
                        fill="none"
                        points={toPoints(run)}
                        strokeLinejoin="round"
                        strokeWidth={1.4}
                    />
                ))
            )}
            <text
                className={`fill-secondary-300 ${LABEL_HALO}`}
                fontSize={labelFontSize - 1}
                fontWeight={600}
                paintOrder="stroke"
                strokeLinejoin="round"
                strokeWidth={3}
                x={frame.left + 4}
                y={frame.top + labelFontSize}
            >
                {pane.label}
            </text>
            {legendLines.map((line, index) => {
                const x = legendXs[index];
                return (
                    <text
                        key={`legend-${line.label}`}
                        className={`${SERIES_TEXT[line.tone ?? 'a']} ${LABEL_HALO}`}
                        fontSize={labelFontSize - 1}
                        fontWeight={600}
                        paintOrder="stroke"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        x={x}
                        y={frame.top + labelFontSize}
                    >
                        {line.label}
                    </text>
                );
            })}
        </g>
    );
}
