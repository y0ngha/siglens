'use client';

/**
 * 거래량 차트 컴포넌트 — 총 거래량·매수/매도 거래량 시리즈를 그린다.
 */

import { useMemo, useRef } from 'react';
import type { IChartApi } from 'lightweight-charts';
import { CHART_COLORS } from '@/shared/lib/chartColors';
import type { Bar, BuySellVolumeResult, Timeframe } from '@y0ngha/siglens-core';
import {
    NO_EXTENDED_BARS,
    NO_SESSION_RANGES,
    buildExtendedSessionRanges,
    isExtendedBarTimeframe,
} from '@/shared/api/market/extendedBarsSession';
import { usePaneLabels } from './hooks/usePaneLabels';
import { useExtendedSessionBand } from './hooks/useExtendedSessionBand';
import { useVolumeChartData } from './hooks/useVolumeChartData';
import { useVolumeChartLifecycle } from './hooks/useVolumeChartLifecycle';
import type { PaneLabelConfig } from './types';
import { useTranslations } from 'next-intl';

interface VolumeChartProps {
    /** 정규장 봉 — 매수/매도 분해는 이 배열과 짝지어진다. */
    bars: Bar[];
    /** 프리·애프터마켓 봉(총 거래량 막대와 음영만). 생략하면 기존과 같다. */
    extendedBars?: Bar[];
    /** 음영 구간을 세션 창으로 나눌 때 쓰는 타임프레임. */
    timeframe?: Timeframe;
    /** 데이터 갱신을 감싸는 래퍼(`useChartSync.runVolumeDataUpdate`) — 가격 차트가 보던 범위를 지킨다. */
    runDataUpdate?: (update: () => void) => void;
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
    extendedBars = NO_EXTENDED_BARS,
    timeframe,
    runDataUpdate,
    buySellVolume,
    onChartReady,
    onChartRemove,
    ticker,
}: VolumeChartProps) {
    const t = useTranslations('widgets.chart');
    const tMisc = useTranslations('shared.ui.misc');
    const wrapperRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    // 테마 전환은 마운트 지점의 `key={themeVersion}`이 이 컴포넌트를 통째로 remount해
    // 처리한다(chartThemeRemountGuard) — 여기서 따로 리렌더를 일으킬 필요가 없다.

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
        extendedBars,
        buySellVolume,
        runUpdate: runDataUpdate,
    });

    const extendedRanges = useMemo(
        () =>
            timeframe !== undefined && isExtendedBarTimeframe(timeframe)
                ? buildExtendedSessionRanges(extendedBars, timeframe)
                : NO_SESSION_RANGES,
        [extendedBars, timeframe]
    );
    useExtendedSessionBand(totalSeriesRef, extendedRanges);

    /* `CHART_COLORS`는 **접근 시점에** 테마를 보는 게터다. 모듈 상수로 두면
       로드 시점의 색이 굳으므로 렌더 안에서 읽되, 읽은 결과를 지역 변수로
       꺼내 둔다 — 그래야 아래 메모의 의존이 린터에게도 보이는 진짜 값이 된다.
       게터를 콜백 안에서 바로 부르면 린터에게는 이 메모가 아무것에도 의존하지
       않는 것처럼 보여 억제 주석이 필요해졌었다. */
    const bullishColor = CHART_COLORS.bullish;
    const bearishColor = CHART_COLORS.bearish;

    const buyLabel = t('VolumeChart.buy');
    const sellLabel = t('VolumeChart.sell');

    /* 메모 자체는 필요하다 — 매 렌더 새 배열을 주면 `usePaneLabels`의 효과가
       매번 다시 돌아 라벨 DOM을 다시 만든다. */
    const volumeLabels = useMemo<PaneLabelConfig[]>(
        () => [
            {
                paneIndex: 0,
                subLabels: [
                    { name: buyLabel, color: bullishColor },
                    { name: sellLabel, color: bearishColor },
                ],
            },
        ],
        [buyLabel, sellLabel, bullishColor, bearishColor]
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
