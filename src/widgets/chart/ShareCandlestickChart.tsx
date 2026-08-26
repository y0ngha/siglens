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
import { CHART_COLORS, getChartChrome } from '@/shared/lib/chartColors';
import { buildCandlestickData } from './utils/candlestickDataUtils';
import { useThemeVersion } from '@/shared/hooks/useThemeVersion';
import { useChartThemeSync } from './hooks/useChartThemeSync';

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
    const themeVersion = useThemeVersion();

    /* 테마 전환 시 크롬만 교체(리마운트 없음). */
    useChartThemeSync(chartRef);
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

        /* 공유 페이지 셸이 테마를 따르므로 차트 크롬도 따라야 한다. 예전에는
           다크 리터럴로 고정돼 있어 라이트 셸 위에 검은 캔버스가 얹혔다. */
        const chrome = getChartChrome();

        const chart = createChart(containerRef.current, {
            autoSize: true,
            layout: {
                background: { color: chrome.background },
                textColor: chrome.text,
            },
            grid: {
                vertLines: { color: chrome.grid },
                horzLines: { color: chrome.grid },
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
        /* `themeVersion`을 deps에 두어 테마 토글 시 차트를 다시 만든다.
       시리즈는 생성 시점의 색을 들고 있어 `applyOptions`만으로는 지표 색이
       안 바뀌고, 오버레이 훅 31개를 각각 배선하는 대신 생성 지점만 건드린다.
       로드 경로에서는 이 값이 0에서 변하지 않으므로 리마운트가 없다. */
    }, [snapshotBars, themeVersion]);

    const ariaLabel =
        ticker !== undefined && ticker !== ''
            ? `${ticker} 스냅샷 캔들 차트`
            : '스냅샷 가격 차트';

    if (snapshotBars.length === 0) {
        return (
            <div className="flex h-48 w-full items-center justify-center">
                <p className="text-sm text-secondary-400">
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
