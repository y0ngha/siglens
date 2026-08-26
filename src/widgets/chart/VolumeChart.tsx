'use client';

import { useMemo, useRef } from 'react';
import type { IChartApi } from 'lightweight-charts';
import { CHART_COLORS } from '@/shared/lib/chartColors';
import type { Bar, BuySellVolumeResult } from '@y0ngha/siglens-core';
import { useThemeVersion } from '@/shared/hooks/useThemeVersion';
import { usePaneLabels } from './hooks/usePaneLabels';
import { useVolumeChartData } from './hooks/useVolumeChartData';
import { useVolumeChartLifecycle } from './hooks/useVolumeChartLifecycle';
import type { PaneLabelConfig } from './types';

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
    const themeVersion = useThemeVersion();

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

    /* 모듈 상수로 두면 로드 시점의 테마 색이 굳는다 — `CHART_COLORS`는 접근
       시점에 테마를 보는 게터이므로 렌더 안에서, 테마 버전을 물고 만든다. */
    const volumeLabels = useMemo<PaneLabelConfig[]>(
        () => [
            {
                paneIndex: 0,
                subLabels: [
                    { name: 'Buy', color: CHART_COLORS.bullish },
                    { name: 'Sell', color: CHART_COLORS.bearish },
                ],
            },
        ],
        /* `CHART_COLORS`는 **접근 시점에** 테마를 보는 게터라, 린터에게는 이
           콜백이 아무 값에도 의존하지 않는 것처럼 보인다. 실제로는 테마가
           바뀌면 다른 색을 내놓아야 하므로 이 의존은 진짜다. 빼면 라이트로
           토글해도 범례 점만 다크 색으로 남는다.
           메모 자체는 필요하다 — 매 렌더 새 배열을 주면 `usePaneLabels`의
           효과가 매번 다시 돌아 라벨 DOM을 다시 만든다. */
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [themeVersion]
    );

    usePaneLabels({
        chartRef,
        containerRef: wrapperRef,
        labels: volumeLabels,
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
