'use client';

import { useRef } from 'react';
import type { IChartApi } from 'lightweight-charts';
import { CHART_COLORS } from '@/shared/lib/chartColors';
import type { Bar, BuySellVolumeResult } from '@y0ngha/siglens-core';
import { usePaneLabels } from '@/components/chart/hooks/usePaneLabels';
import { useVolumeChartData } from '@/components/chart/hooks/useVolumeChartData';
import { useVolumeChartLifecycle } from '@/components/chart/hooks/useVolumeChartLifecycle';
import type { PaneLabelConfig } from '@/components/chart/types';

const VOLUME_LABELS: PaneLabelConfig[] = [
    {
        paneIndex: 0,
        subLabels: [
            { name: 'Buy', color: CHART_COLORS.bullish },
            { name: 'Sell', color: CHART_COLORS.bearish },
        ],
    },
];

interface VolumeChartProps {
    bars: Bar[];
    buySellVolume: BuySellVolumeResult[];
    /** 차트 인스턴스가 준비되면 호출된다. 캔들차트와 visible range 동기화에 사용된다. */
    onChartReady?: (chart: IChartApi) => void;
    /** 차트가 제거되기 직전에 호출된다. 구독 해제에 사용된다. */
    onChartRemove?: () => void;
    /** aria-label에 들어갈 ticker — 스크린 리더 안내용. 없으면 generic label로 fallback. */
    ticker?: string;
}

export function VolumeChart({
    bars,
    buySellVolume,
    onChartReady,
    onChartRemove,
    ticker,
}: VolumeChartProps) {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const { chartRef, totalSeriesRef, buySeriesRef } = useVolumeChartLifecycle({
        containerRef,
        onChartReady,
        onChartRemove,
    });

    useVolumeChartData({
        chartRef,
        totalSeriesRef,
        buySeriesRef,
        bars,
        buySellVolume,
    });

    usePaneLabels({
        chartRef,
        containerRef: wrapperRef,
        labels: VOLUME_LABELS,
    });

    // Lightweight Charts 캔버스는 스크린 리더에 노출되지 않으므로 캔버스 컨테이너에 role/aria-label.
    // wrapperRef가 아닌 containerRef에 두어 향후 wrapper에 인터랙티브 자식이 추가돼도 영향 없게.
    const chartAriaLabel =
        ticker !== undefined && ticker !== ''
            ? `${ticker} 거래량 차트`
            : '거래량 차트';

    return (
        <div ref={wrapperRef} className="relative h-full w-full">
            <div
                ref={containerRef}
                className="h-full w-full"
                role="img"
                aria-label={chartAriaLabel}
            />
        </div>
    );
}
