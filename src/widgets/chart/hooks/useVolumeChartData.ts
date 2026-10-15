'use client';

import { type RefObject, useEffect, useRef } from 'react';
import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import { tailAligned } from '../utils/seriesDataUtils';
import { buildTotalVolumeData } from '../utils/extendedBarsDisplay';
import type { Bar, BuySellVolumeResult } from '@y0ngha/siglens-core';

interface UseVolumeChartDataOptions {
    chartRef: RefObject<IChartApi | null>;
    totalSeriesRef: RefObject<ISeriesApi<'Histogram'> | null>;
    buySeriesRef: RefObject<ISeriesApi<'Histogram'> | null>;
    /** 정규장 봉 — 매수/매도 분해(`buySellVolume`)는 이 배열과 tail 정렬된다. */
    bars: Bar[];
    /** 프리·애프터마켓 봉(총 거래량 막대에만 얹는다 — 분해가 없다). 생략 시 없음. */
    extendedBars?: Bar[];
    buySellVolume: BuySellVolumeResult[];
    /**
     * 데이터 갱신(`setData`·시간축 맞춤)을 감싸는 래퍼. 거래량 차트가 갱신 중 내는 보이는 범위 변경이 가격
     * 차트로 번지지 않게 하고, 끝나면 가격 차트의 범위에 맞춘다(`useChartSync.runVolumeDataUpdate`).
     * 생략하면 그대로 실행한다.
     */
    runUpdate?: (update: () => void) => void;
}

const NO_EXTENDED_BARS: Bar[] = [];
const runDirectly = (update: () => void): void => update();

export function useVolumeChartData({
    chartRef,
    totalSeriesRef,
    buySeriesRef,
    bars,
    extendedBars = NO_EXTENDED_BARS,
    buySellVolume,
    runUpdate = runDirectly,
}: UseVolumeChartDataOptions): void {
    // 시간축 맞춤은 정규장 데이터가 바뀔 때만 한다. 시간외 봉만 도착·토글된 경우는 가격 차트가 보던 자리를
    // 지키거나 다시 맞추고(`StockChart`), 두 차트의 보이는 범위는 `useChartSync`가 맞춘다 — 여기서 또 맞추면
    // 사용자가 보던 범위를 덮는다.
    const fittedForRef = useRef<{
        bars: Bar[];
        buySellVolume: BuySellVolumeResult[];
    } | null>(null);

    useEffect(() => {
        if (
            !totalSeriesRef.current ||
            !buySeriesRef.current ||
            !chartRef.current
        )
            return;

        if (bars.length === 0 || buySellVolume.length === 0) {
            totalSeriesRef.current.setData([]);
            buySeriesRef.current.setData([]);
            return;
        }

        const total = totalSeriesRef.current;
        const buy = buySeriesRef.current;
        const chart = chartRef.current;
        runUpdate(() => {
            total.setData(buildTotalVolumeData(bars, extendedBars));

            // 정렬 규약은 `tailAligned`가 소유한다. 예전 주석은 "인프라 계층이 길이를
            // 보장한다"였는데, RSC seed가 지표를 축소해 보내면서 그 전제가 깨졌다
            // (`getSeedBarsStatic`). 좌측 정렬 + non-null 단언 조합은 길이가 어긋나면
            // `undefined.buyVolume`으로 **throw**했다 — 사이에 ErrorBoundary가 없어
            // 차트가 통째로 빈다.
            buy.setData(
                tailAligned(bars, buySellVolume).map(({ time }, i) => ({
                    time: time as UTCTimestamp,
                    value: buySellVolume[i]?.buyVolume ?? 0,
                }))
            );

            const fitted = fittedForRef.current;
            const regularChanged =
                fitted === null ||
                fitted.bars !== bars ||
                fitted.buySellVolume !== buySellVolume;
            fittedForRef.current = { bars, buySellVolume };
            if (regularChanged) chart.timeScale().fitContent();
        });
    }, [
        bars,
        extendedBars,
        buySellVolume,
        chartRef,
        totalSeriesRef,
        buySeriesRef,
        runUpdate,
    ]);
}
