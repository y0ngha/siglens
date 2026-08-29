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
import { useTranslations } from 'next-intl';

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
    const t = useTranslations('widgets.chart');
    const tMisc = useTranslations('shared.ui.misc');
    const wrapperRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    /* 반환값을 쓰지 않고 호출만 한다 — 이 훅의 일은 테마가 바뀌었을 때
       리렌더를 일으키는 것뿐이고, 바뀐 색은 아래 `CHART_COLORS` 읽기가
       가져온다. 버전 숫자 자체를 의존성으로 쓰면 린터가 볼 수 없는 간접
       의존이 되어 억제 주석이 필요해진다. */
    useThemeVersion();

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

    /* `CHART_COLORS`는 **접근 시점에** 테마를 보는 게터다. 모듈 상수로 두면
       로드 시점의 색이 굳으므로 렌더 안에서 읽되, 읽은 결과를 지역 변수로
       꺼내 둔다 — 그래야 아래 메모의 의존이 린터에게도 보이는 진짜 값이 된다.
       게터를 콜백 안에서 바로 부르면 린터에게는 이 메모가 아무것에도 의존하지
       않는 것처럼 보여 억제 주석이 필요해졌었다. */
    const bullishColor = CHART_COLORS.bullish;
    const bearishColor = CHART_COLORS.bearish;

    /* 메모 자체는 필요하다 — 매 렌더 새 배열을 주면 `usePaneLabels`의 효과가
       매번 다시 돌아 라벨 DOM을 다시 만든다. */
    const volumeLabels = useMemo<PaneLabelConfig[]>(
        () => [
            {
                paneIndex: 0,
                subLabels: [
                    { name: 'Buy', color: bullishColor },
                    { name: 'Sell', color: bearishColor },
                ],
            },
        ],
        [bullishColor, bearishColor]
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
            ? tMisc('volumeChartAria', { v0: ticker })
            : t('VolumeChart.1ae051');

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
