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

import { useEffect, useRef, useState } from 'react';
import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import {
    CandlestickSeries,
    CrosshairMode,
    createChart,
} from 'lightweight-charts';
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

    /**
     * Capture the mount-time bars via lazy initializer so the effect dependency
     * array is satisfied without disabling the exhaustive-deps rule. The snapshot
     * is intentionally immutable — the share page chart never re-renders with new
     * bars, so a stable reference is exactly what we want.
     */
    const [snapshotBars] = useState(() => bars);

    useEffect(() => {
        if (!containerRef.current || snapshotBars.length === 0) return;

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
            // Hide crosshair on the share page — read-only static snapshot view.
            crosshair: {
                mode: CrosshairMode.Hidden,
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
        seriesRef.current.setData(
            buildCandlestickData(snapshotBars, [], false)
        );
        chart.timeScale().fitContent();

        return () => {
            chart.applyOptions({ autoSize: false });
            chart.remove();
            chartRef.current = null;
            seriesRef.current = null;
        };
    }, [snapshotBars]);

    const ariaLabel =
        ticker !== undefined && ticker !== ''
            ? `${ticker} 스냅샷 캔들 차트`
            : '스냅샷 가격 차트';

    if (snapshotBars.length === 0) {
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
