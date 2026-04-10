'use client';

import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type {
    IPriceLine,
    ISeriesApi,
    LineWidth,
    UTCTimestamp,
} from 'lightweight-charts';
import { LineStyle } from 'lightweight-charts';
import type { ValidatedActionPrices } from '@/domain/types';
import { CHART_COLORS } from '@/lib/chartColors';
import { DEFAULT_LINE_WIDTH } from '@/components/chart/constants';

interface UseActionRecommendationOverlayParams {
    seriesRef: RefObject<ISeriesApi<'Candlestick', UTCTimestamp> | null>;
    actionPrices: ValidatedActionPrices | undefined;
    isVisible: boolean;
    lineWidth?: LineWidth;
}

export function useActionRecommendationOverlay({
    seriesRef,
    actionPrices,
    isVisible,
    lineWidth = DEFAULT_LINE_WIDTH,
}: UseActionRecommendationOverlayParams): void {
    const priceLinesRef = useRef<IPriceLine[]>([]);

    useEffect(() => {
        const series = seriesRef.current;

        // 기존 가격선 제거
        priceLinesRef.current.forEach(pl => series?.removePriceLine(pl));
        priceLinesRef.current = [];

        if (!series || !isVisible || !actionPrices) return;

        const entryLines = actionPrices.entryPrices.map((price, idx) =>
            series.createPriceLine({
                price,
                color: CHART_COLORS.actionEntry,
                lineWidth,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: true,
                title: `진입점 #${idx + 1}`,
            })
        );

        const stopLossLine =
            actionPrices.stopLoss !== undefined
                ? [
                      series.createPriceLine({
                          price: actionPrices.stopLoss,
                          color: CHART_COLORS.actionStopLoss,
                          lineWidth,
                          lineStyle: LineStyle.Dashed,
                          axisLabelVisible: true,
                          title: '손절점',
                      }),
                  ]
                : [];

        const takeProfitLines = actionPrices.takeProfitPrices.map((price, idx) =>
            series.createPriceLine({
                price,
                color: CHART_COLORS.actionTakeProfit,
                lineWidth,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: true,
                title: `청산점 #${idx + 1}`,
            })
        );

        priceLinesRef.current = [...entryLines, ...stopLossLine, ...takeProfitLines];
    }, [actionPrices, isVisible, lineWidth]);
}
