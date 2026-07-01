'use client';

/**
 * Read-only candlestick chart for the /share/[id] page (chart kind).
 *
 * Renders static snapshot bars via Lightweight Charts without any live hooks,
 * indicators, timeframe switcher, or interaction controls. Intentionally kept
 * minimal — the share page shows the chart for visual context alongside the
 * AI analysis panel, not as an interactive analysis tool.
 *
 * Kept in widgets/chart (rather than widgets/share) to consolidate all
 * lightweight-charts usage in one widget boundary.
 */

import { useEffect, useRef } from 'react';
import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import { CandlestickSeries, createChart } from 'lightweight-charts';
import type { Bar } from '@y0ngha/siglens-core';
import { CHART_COLORS } from '@/shared/lib/chartColors';
import { buildCandlestickData } from './utils/candlestickDataUtils';

interface ShareCandlestickChartProps {
    bars: Bar[];
    /** aria-label에 들어갈 ticker — 스크린 리더에 차트 종목 안내. */
    ticker?: string;
}

/**
 * Lightweight Charts mount — no indicators, no interactive overlay.
 * Bars are set once on mount; the component does not react to bar changes
 * (the snapshot is immutable after creation).
 */
export function ShareCandlestickChart({
    bars,
    ticker,
}: ShareCandlestickChartProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    // Store chart and series refs for cleanup.
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Candlestick', UTCTimestamp> | null>(
        null
    );

    useEffect(() => {
        if (!containerRef.current || bars.length === 0) return;

        const chart = createChart(containerRef.current, {
            autoSize: true,
            layout: {
                background: { color: CHART_COLORS.background },
                textColor: CHART_COLORS.text,
            },
            grid: {
                vertLines: { color: CHART_COLORS.grid },
                horzLines: { color: CHART_COLORS.grid },
            },
            // Disable crosshair interaction on the share page — read-only view.
            crosshair: {
                mode: 0, // CrosshairMode.Normal=0; imported enum would bloat this file
            },
            // Hide the time scale buttons (no navigation needed for static bars).
            timeScale: {
                fixLeftEdge: true,
                fixRightEdge: true,
            },
        });

        chartRef.current = chart;

        // Bars on the share page are always plain candlesticks — no Elder Impulse.
        seriesRef.current = chart.addSeries(CandlestickSeries, {
            upColor: CHART_COLORS.bullish,
            downColor: CHART_COLORS.bearish,
            borderUpColor: CHART_COLORS.bullish,
            borderDownColor: CHART_COLORS.bearish,
            wickUpColor: CHART_COLORS.bullish,
            wickDownColor: CHART_COLORS.bearish,
            priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
        }) as ISeriesApi<'Candlestick', UTCTimestamp>;

        // No Elder Impulse on the share chart — pass empty array and isActive=false.
        seriesRef.current.setData(buildCandlestickData(bars, [], false));
        chart.timeScale().fitContent();

        return () => {
            chart.applyOptions({ autoSize: false });
            chart.remove();
            chartRef.current = null;
            seriesRef.current = null;
        };
        // Mount-only: bars are snapshot-immutable; no deps intentional.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const ariaLabel =
        ticker !== undefined && ticker !== ''
            ? `${ticker} 스냅샷 캔들 차트`
            : '스냅샷 가격 차트';

    if (bars.length === 0) {
        return (
            <div className="flex h-48 w-full items-center justify-center">
                <p className="text-secondary-400 text-sm">
                    차트 데이터가 없습니다
                </p>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className="h-48 w-full sm:h-64"
            role="img"
            aria-label={ariaLabel}
        />
    );
}
