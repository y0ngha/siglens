import { cn } from '@/shared/lib/cn';
import {
    linearScale,
    splitRuns,
    toPoints,
} from '@/views/guide/lib/chartLayout';
import {
    DEMO_AXIS_TEXT_GAP,
    type PaneFrame,
} from '@/views/guide/lib/demoChartLayout';
import {
    legendPositions,
    PANE_INNER_PAD,
    PANE_LABEL_INSET,
    paneDomain,
    paneLevelText,
    paneTicks,
    paneTickText,
} from '@/views/guide/lib/demoPaneLayout';
import type { DemoPane } from '@/views/guide/demos/types';
import {
    LABEL_HALO,
    SERIES_STROKE,
    SERIES_TEXT,
    TONE_FILL,
} from '@/views/guide/ui/guideChartStyles';

interface GuideDemoPaneProps {
    readonly pane: DemoPane;
    readonly frame: PaneFrame;
    readonly labelFontSize: number;
}

/**
 * 데모 차트의 가격 영역 아래에 붙는 보조 패널(RSI·MACD·거래량 등) SVG 조각. x축(`frame.xOf`)은 가격 차트와
 * 공유하고, y축은 패널마다 자기 값 범위(`paneDomain`)로 따로 잡는다.
 */
export function GuideDemoPane({
    pane,
    frame,
    labelFontSize,
}: GuideDemoPaneProps) {
    const [min, max] = paneDomain(pane);
    const innerTop = frame.top + PANE_INNER_PAD;
    const innerBottom = frame.top + frame.height - PANE_INNER_PAD;
    const yOf = linearScale(min, max, innerBottom, innerTop);
    const levelValues = (pane.levels ?? []).map(level => level.value);
    const { ticks, step } = paneTicks(min, max, levelValues, yOf);
    const baseline = min <= 0 && max >= 0 ? yOf(0) : innerBottom;
    const barWidth = Math.max(1.2, frame.pitch * 0.7);
    const legendLines = (pane.lines ?? []).filter(line => line.label !== '');
    const legendXs = legendPositions(
        pane.label,
        legendLines.map(line => line.label),
        frame.left,
        labelFontSize
    );

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
                        // 히스토그램 막대는 위치가 곧 x좌표인 정적 시리즈라 인덱스 외의 정체성이 없다.
                        // react-doctor-disable-next-line react-doctor/no-array-index-as-key
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
                        x={frame.right + DEMO_AXIS_TEXT_GAP}
                        y={yOf(level.value)}
                    >
                        {level.label ?? paneLevelText(level.value)}
                    </text>
                </g>
            ))}
            {ticks.map(tick => (
                <text
                    key={`tick-${tick}`}
                    className="fill-secondary-400"
                    dominantBaseline="middle"
                    fontSize={labelFontSize - 1}
                    x={frame.right + DEMO_AXIS_TEXT_GAP}
                    y={yOf(tick)}
                >
                    {paneTickText(tick, step)}
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
                className={cn('fill-secondary-300', LABEL_HALO)}
                fontSize={labelFontSize - 1}
                fontWeight={600}
                paintOrder="stroke"
                strokeLinejoin="round"
                strokeWidth={3}
                x={frame.left + PANE_LABEL_INSET}
                y={frame.top + labelFontSize}
            >
                {pane.label}
            </text>
            {legendLines.map((line, index) => {
                const x = legendXs[index];
                return (
                    <text
                        key={`legend-${line.label}`}
                        className={cn(
                            SERIES_TEXT[line.tone ?? 'a'],
                            LABEL_HALO
                        )}
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
