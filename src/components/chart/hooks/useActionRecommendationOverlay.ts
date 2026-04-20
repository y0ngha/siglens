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
import type {
    ReconciledActionLineData,
    ValidatedActionPrices,
} from '@/domain/types';
import { CHART_COLORS } from '@/lib/chartColors';
import { DEFAULT_LINE_WIDTH } from '@/components/chart/constants';

/**
 * 보정값(reconciledLevels) 차트 라인 스타일.
 * - 대시 스타일로 AI 원본과 시각적으로 구분
 * - 같은 semantic color에 알파 접미사를 붙여 톤을 낮춤
 */
/** 보정값 라인용 8-bit hex alpha 접미사 (0x99 ≈ 60% opacity). */
const RECONCILED_HEX_ALPHA = '99';
const RECONCILED_STOP_LOSS_COLOR = `${CHART_COLORS.actionStopLoss}${RECONCILED_HEX_ALPHA}`;
const RECONCILED_TAKE_PROFIT_COLOR = `${CHART_COLORS.actionTakeProfit}${RECONCILED_HEX_ALPHA}`;

interface UseActionRecommendationOverlayParams {
    seriesRef: RefObject<ISeriesApi<'Candlestick', UTCTimestamp> | null>;
    actionPrices: ValidatedActionPrices | undefined;
    reconciledPrices?: ReconciledActionLineData;
    isVisible: boolean;
    lineWidth?: LineWidth;
}

export function useActionRecommendationOverlay({
    seriesRef,
    actionPrices,
    reconciledPrices,
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

        const takeProfitLines = actionPrices.takeProfitPrices.map(
            (price, idx) =>
                series.createPriceLine({
                    price,
                    color: CHART_COLORS.actionTakeProfit,
                    lineWidth,
                    lineStyle: LineStyle.Dashed,
                    axisLabelVisible: true,
                    title: `청산점 #${idx + 1}`,
                })
        );

        // 보정값 라인 (dashed + 반투명). AI 값과 다를 때만 라벨 "(보정)"을 병기한다.
        const reconciledStopLossLine =
            reconciledPrices?.stopLoss !== undefined
                ? [
                      series.createPriceLine({
                          price: reconciledPrices.stopLoss,
                          color: RECONCILED_STOP_LOSS_COLOR,
                          lineWidth,
                          lineStyle: LineStyle.LargeDashed,
                          axisLabelVisible: true,
                          title: '손절 (보정)',
                      }),
                  ]
                : [];

        const reconciledTakeProfitLines =
            reconciledPrices?.takeProfitPrices.map(tp =>
                series.createPriceLine({
                    price: tp.price,
                    color: RECONCILED_TAKE_PROFIT_COLOR,
                    lineWidth,
                    lineStyle: LineStyle.LargeDashed,
                    axisLabelVisible: true,
                    title:
                        tp.totalCount > 1
                            ? `#${tp.index + 1} 청산 (보정)`
                            : '목표가 (보정)',
                })
            ) ?? [];

        priceLinesRef.current = [
            ...entryLines,
            ...stopLossLine,
            ...takeProfitLines,
            ...reconciledStopLossLine,
            ...reconciledTakeProfitLines,
        ];
    }, [actionPrices, reconciledPrices, isVisible, lineWidth, seriesRef]);
}
