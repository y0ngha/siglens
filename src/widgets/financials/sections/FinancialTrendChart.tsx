'use client';

/**
 * 다기간 재무 추세 막대 차트 오케스트레이터 — 호버 상태와 배치 계산을 잇고, 범례·SVG·축·툴팁은
 * `ui/trend-chart`가 그린다.
 */
import { useState, type PointerEvent } from 'react';
import { TrendChartAxis } from '../ui/trend-chart/TrendChartAxis';
import { TrendChartLegend } from '../ui/trend-chart/TrendChartLegend';
import { TrendChartPlot } from '../ui/trend-chart/TrendChartPlot';
import { TrendChartTooltip } from '../ui/trend-chart/TrendChartTooltip';
import {
    DEFAULT_STATEMENT_CURRENCY,
    type StatementCurrency,
} from '../utils/statementCurrency';
import { placeTooltip, type TooltipPosition } from '../utils/tooltipPosition';
import {
    buildTrendBars,
    computeTrendLayout,
} from '../utils/trendChartGeometry';
import type { TrendSeries } from '../utils/trendChartTypes';

interface FinancialTrendChartProps {
    series: TrendSeries[];
    /** 기간 라벨 — 과거→최신(좌→우) 순서. */
    periods: string[];
    /** 툴팁 금액에 적용할 통화. 생략하면 USD — 미국 종목의 기본 동작. */
    currency?: StatementCurrency;
}

interface HoverState extends TooltipPosition {
    periodIdx: number;
}

/**
 * 다중 시리즈 N기간 재무 추세를 인라인 SVG 막대로 그린다. 차트 라이브러리를 쓰지 않아 SSR로
 * 그려진 막대가 크롤 가능하고, 호버 판독은 마우스 전용 점진적 향상이다(접근 가능한 수치 출처는
 * 아래 StatementTable). 막대 색은 시리즈가 선언한 색을 따르고 부호는 baseline 위/아래 방향이
 * 나른다. 너비는 100%, 높이는 고정이다.
 */
export function FinancialTrendChart({
    series,
    periods,
    currency = DEFAULT_STATEMENT_CURRENCY,
}: FinancialTrendChartProps) {
    const [hover, setHover] = useState<HoverState | null>(null);

    if (periods.length === 0 || series.length === 0) return null;

    const layout = computeTrendLayout(series, periods.length);
    const bars = buildTrendBars(series, layout);

    const handlePointer = (periodIdx: number, event: PointerEvent) => {
        setHover({
            periodIdx,
            ...placeTooltip(event.clientX, event.clientY),
        });
    };

    return (
        <div className="relative w-full">
            <TrendChartLegend series={series} />
            <TrendChartPlot
                periods={periods}
                layout={layout}
                bars={bars}
                activePeriodIdx={hover?.periodIdx ?? null}
                onPointer={handlePointer}
                onLeave={() => setHover(null)}
            />
            <TrendChartAxis periods={periods} />
            {hover !== null && (
                <TrendChartTooltip
                    series={series}
                    periodLabel={periods[hover.periodIdx]}
                    periodIdx={hover.periodIdx}
                    position={hover}
                    currency={currency}
                />
            )}
        </div>
    );
}
