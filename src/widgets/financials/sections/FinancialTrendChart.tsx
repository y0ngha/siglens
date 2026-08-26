'use client';

import { useState, type CSSProperties } from 'react';
import { cn } from '@/shared/lib/cn';
import {
    formatCurrencyCompact,
    DEFAULT_STATEMENT_CURRENCY,
    type StatementCurrency,
} from '../utils/numberFormat';
import { placeTooltip, type TooltipPosition } from '../utils/tooltipPosition';

type SeriesColor = 'bullish' | 'bearish' | 'neutral';

interface TrendSeries {
    labelKo: string;
    /**
     * Values aligned to the `periods` array. Oldest→newest (left-to-right).
     * Null means no data for that period.
     */
    values: (number | null)[];
    color?: SeriesColor;
}

interface FinancialTrendChartProps {
    series: TrendSeries[];
    /**
     * Period labels — oldest first (left-to-right display order).
     */
    periods: string[];
    /** 툴팁 금액에 적용할 통화. 생략하면 USD — 미국 종목의 기존 동작. */
    currency?: StatementCurrency;
}

const SVG_HEIGHT = 120;
const SVG_PADDING_TOP = 8;
const SVG_PADDING_BOTTOM = 8;
const SVG_PADDING_LEFT = 4;
const SVG_PADDING_RIGHT = 4;
const CHART_HEIGHT = SVG_HEIGHT - SVG_PADDING_TOP - SVG_PADDING_BOTTOM;

interface SeriesColorClasses {
    fill: string;
    stroke: string;
    legend: string;
    dot: string;
}

/**
 * 막대 채움이 `/85`인 이유: `/70`은 라이트 카드(흰색) 위에서 2.64:1로
 * 그래픽 기준(3:1)을 밑돈다 — 다크는 통과라 다크만 보면 안 보인다.
 * `/85`는 램프 세 표면 × 양 테마 전부에서 3.34 이상이고, 옵션 차트의
 * 막대·`FearGreedGroupBar`의 GREED 밴드와 같은 값이다. 알파를 아예 빼면
 * 막대가 선(stroke)과 붙어 보인다.
 *
 * **리터럴로 적는다.** 알파를 상수로 빼서 템플릿으로 조립하면 Tailwind의
 * 정적 추출이 그 클래스를 못 보고 규칙이 통째로 안 구워진다 — 타입도 빌드도
 * 통과하는데 화면에서만 색이 사라진다.
 */
const COLOR_CLASSES: Record<SeriesColor, SeriesColorClasses> = {
    bullish: {
        fill: 'fill-chart-bullish/85',
        stroke: 'stroke-chart-bullish',
        legend: 'bg-chart-bullish',
        dot: 'bg-chart-bullish',
    },
    bearish: {
        fill: 'fill-chart-bearish/85',
        stroke: 'stroke-chart-bearish',
        legend: 'bg-chart-bearish',
        dot: 'bg-chart-bearish',
    },
    neutral: {
        fill: 'fill-primary-500/85',
        stroke: 'stroke-primary-500',
        legend: 'bg-primary-500',
        dot: 'bg-primary-500',
    },
};

function barHeight(
    value: number,
    maxAbs: number,
    availableHeight: number
): number {
    if (maxAbs === 0) return 0;
    return (Math.abs(value) / maxAbs) * availableHeight;
}

function barX(
    periodIdx: number,
    seriesIdx: number,
    barGroupWidth: number,
    barPadding: number,
    singleBarWidth: number
): string {
    const groupStart =
        SVG_PADDING_LEFT + periodIdx * barGroupWidth + barPadding;
    return `${groupStart + seriesIdx * singleBarWidth}%`;
}

function barY(value: number, height: number, baselineY: number): number {
    return value >= 0 ? baselineY - height : baselineY;
}

function resolveColor(
    series: TrendSeries[],
    seriesIdx: number,
    value: number | null
): SeriesColorClasses {
    if (value !== null && value < 0) return COLOR_CLASSES.bearish;
    const c = series[seriesIdx]?.color ?? 'neutral';
    return COLOR_CLASSES[c];
}

function fmt(value: number | null, currency: StatementCurrency): string {
    return value === null ? '—' : formatCurrencyCompact(value, currency);
}

interface HoverState extends TooltipPosition {
    periodIdx: number;
}

/**
 * Inline SVG bar chart for multi-series N-year financial trend data.
 * No chart library — pure SVG. SSR-rendered bars stay crawlable; the hover
 * readout (mouse-only progressive enhancement — the StatementTable below is the
 * accessible value source) shows each series' value for the hovered period,
 * mirroring the options page charts.
 *
 * Negative values are colored bearish regardless of the series color prop.
 * Responsive: width="100%", height is fixed.
 */
export function FinancialTrendChart({
    series,
    periods,
    currency = DEFAULT_STATEMENT_CURRENCY,
}: FinancialTrendChartProps) {
    const [hover, setHover] = useState<HoverState | null>(null);

    const n = periods.length;
    const seriesCount = series.length;
    if (n === 0 || seriesCount === 0) return null;

    const allValues: number[] = series.flatMap(s =>
        s.values.filter((v): v is number => v !== null)
    );

    // reduce keeps this O(n) and stack-safe regardless of array size
    // (Math.max(...spread) overflows the call stack on very large inputs).
    const maxAbs = allValues.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
    const hasNegative = allValues.some(v => v < 0);

    const barGroupWidth = (100 - (SVG_PADDING_LEFT + SVG_PADDING_RIGHT)) / n;
    const barPadding = barGroupWidth * 0.1;
    const singleBarWidth = (barGroupWidth - barPadding * 2) / seriesCount;

    const baselineY = hasNegative
        ? SVG_PADDING_TOP + CHART_HEIGHT / 2
        : SVG_PADDING_TOP + CHART_HEIGHT;

    const availableHeight = hasNegative ? CHART_HEIGHT / 2 : CHART_HEIGHT;

    return (
        <div className="relative w-full">
            {seriesCount > 1 && (
                <div className="mb-2 flex flex-wrap gap-3">
                    {series.map(s => {
                        const c = s.color ?? 'neutral';
                        return (
                            <div
                                key={s.labelKo}
                                className="flex items-center gap-1"
                            >
                                <span
                                    className={cn(
                                        'inline-block h-2 w-2 rounded-full',
                                        COLOR_CLASSES[c].legend
                                    )}
                                />
                                <span className="text-xs text-secondary-400">
                                    {s.labelKo}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
            {seriesCount === 1 && (
                <div className="mb-1">
                    <span className="text-xs text-secondary-400">
                        {series[0].labelKo}
                    </span>
                </div>
            )}

            <svg
                width="100%"
                height={SVG_HEIGHT}
                aria-hidden="true"
                role="presentation"
                className="overflow-visible"
                viewBox={`0 0 100 ${SVG_HEIGHT}`}
                preserveAspectRatio="none"
            >
                <line
                    x1={`${SVG_PADDING_LEFT}%`}
                    y1={baselineY}
                    x2={`${100 - SVG_PADDING_RIGHT}%`}
                    y2={baselineY}
                    className="stroke-secondary-700"
                    strokeWidth="0.5"
                />

                {series.map((s, si) =>
                    s.values.map((v, pi) => {
                        if (v === null) return null;
                        const colors = resolveColor(series, si, v);
                        const h = barHeight(v, maxAbs, availableHeight);
                        if (h === 0) return null;

                        return (
                            <rect
                                key={`${si}-${pi}`}
                                x={barX(
                                    pi,
                                    si,
                                    barGroupWidth,
                                    barPadding,
                                    singleBarWidth
                                )}
                                y={barY(v, h, baselineY)}
                                width={`${singleBarWidth}%`}
                                height={h}
                                rx="1"
                                className={cn(
                                    colors.fill,
                                    // `opacity-40`이었다. 채움이 이미 `/85`라
                                    // 실효 알파가 0.34가 되어 비활성 기간이
                                    // 1.5:1까지 떨어졌다 — 흐려지는 게 아니라
                                    // 사실상 사라진다. 강조 대비는 유지하되
                                    // 나머지도 읽히도록 올린다.
                                    //
                                    // 여기서 멈추는 이유를 숫자로 남긴다. 실효
                                    // 알파는 0.85 x 0.60 = 0.51이고, 흰 카드
                                    // 위 상승 막대가 2.09:1이다(다크 2.45) —
                                    // 1.4.11의 3:1에 못 미친다. 그런데 알파만
                                    // 올려서는 못 넘긴다: 0.70이 2.40,
                                    // 0.80이 2.76이고 3:1을 넘는 것은 0.90
                                    // (3.19)부터인데, 그 값은 강조된 막대의
                                    // 0.85와 사실상 같아서 호버 구분 자체가
                                    // 사라진다. 기준을 넘기려면 알파가 아니라
                                    // 채도를 낮추거나 강조 쪽에 표시를 더하는
                                    // 방식이어야 하고, 그건 이 PR 범위 밖이다.
                                    hover !== null &&
                                        hover.periodIdx !== pi &&
                                        'opacity-60'
                                )}
                            />
                        );
                    })
                )}

                {periods.map((p, pi) => (
                    <rect
                        key={`hit-${p}`}
                        x={`${SVG_PADDING_LEFT + pi * barGroupWidth}%`}
                        y={SVG_PADDING_TOP}
                        width={`${barGroupWidth}%`}
                        height={CHART_HEIGHT}
                        fill="transparent"
                        className="cursor-crosshair"
                        onPointerEnter={e =>
                            setHover({
                                periodIdx: pi,
                                ...placeTooltip(e.clientX, e.clientY),
                            })
                        }
                        onPointerMove={e =>
                            setHover({
                                periodIdx: pi,
                                ...placeTooltip(e.clientX, e.clientY),
                            })
                        }
                        onPointerLeave={() => setHover(null)}
                    />
                ))}
            </svg>

            <div className="mt-1 flex justify-between">
                {periods.map(p => (
                    <span key={p} className="text-xs text-secondary-400">
                        {p}
                    </span>
                ))}
            </div>

            {hover !== null && (
                <div
                    data-testid="chart-tooltip"
                    // 마우스 전용 프로그레시브 인핸스먼트 — 트리거(hit rect)가
                    // aria-hidden SVG 안에 있어 AT에서 도달 불가하다. role="tooltip"은
                    // AT 노출이 전제인 위젯 역할이라 aria-hidden과 모순되므로 쓰지 않고,
                    // 접근성 트리에서 완전히 숨긴다. AT 사용자는 아래 StatementTable에서
                    // 동일 수치에 접근하고, 테스트는 data-testid로 조회한다.
                    aria-hidden="true"
                    className="pointer-events-none fixed top-[var(--tip-top)] left-[var(--tip-left)] z-50 rounded-lg border border-secondary-600 bg-secondary-900 px-3 py-2 text-xs shadow-lg"
                    style={
                        {
                            '--tip-left': `${hover.left}px`,
                            '--tip-top': `${hover.top}px`,
                        } as CSSProperties
                    }
                >
                    <div className="mb-1 font-medium text-secondary-300">
                        {periods[hover.periodIdx]}
                    </div>
                    <ul className="space-y-0.5">
                        {series.map(s => {
                            const c = s.color ?? 'neutral';
                            const v = s.values[hover.periodIdx] ?? null;
                            return (
                                <li
                                    key={s.labelKo}
                                    className="flex items-center justify-between gap-3"
                                >
                                    <span className="flex items-center gap-1">
                                        <span
                                            className={cn(
                                                'inline-block h-2 w-2 rounded-full',
                                                v !== null && v < 0
                                                    ? COLOR_CLASSES.bearish.dot
                                                    : COLOR_CLASSES[c].dot
                                            )}
                                        />
                                        <span className="text-secondary-400">
                                            {s.labelKo}
                                        </span>
                                    </span>
                                    <span className="font-mono tabular-nums">
                                        {fmt(v, currency)}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
}
