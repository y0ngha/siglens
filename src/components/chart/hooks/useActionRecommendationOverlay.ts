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

/**
 * 보정값(reconciledLevels) 차트 라인 스타일.
 * - 대시 스타일로 AI 원본과 시각적으로 구분
 * - 같은 semantic color에 알파 접미사를 붙여 톤을 낮춤
 */
const RECONCILED_STOP_LOSS_COLOR = `${CHART_COLORS.actionStopLoss}99`; // ~60% opacity
const RECONCILED_TAKE_PROFIT_COLOR = `${CHART_COLORS.actionTakeProfit}99`;

/**
 * 보정값(reconciled) SL/TP 라인 데이터. AI 원본과 별도로 병기 렌더링된다.
 * - AI 값과 동일하면 중복 표시를 피하기 위해 호출 측에서 필터링한 뒤 전달한다.
 */
export interface ReconciledActionPrices {
    /** 보정된 stopLoss. AI 값과 다를 때만 전달. */
    readonly stopLoss?: number;
    /** 보정된 takeProfitPrices 중 AI 원본과 다른 인덱스만 포함한 리스트. */
    readonly takeProfitPrices: readonly {
        readonly index: number;
        readonly price: number;
        /** 다중 TP일 때 라벨 분기에 사용 */
        readonly totalCount: number;
    }[];
}

interface UseActionRecommendationOverlayParams {
    seriesRef: RefObject<ISeriesApi<'Candlestick', UTCTimestamp> | null>;
    actionPrices: ValidatedActionPrices | undefined;
    reconciledPrices?: ReconciledActionPrices;
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
        const reconciledLines: IPriceLine[] = [];
        if (reconciledPrices) {
            if (reconciledPrices.stopLoss !== undefined) {
                reconciledLines.push(
                    series.createPriceLine({
                        price: reconciledPrices.stopLoss,
                        color: RECONCILED_STOP_LOSS_COLOR,
                        lineWidth,
                        lineStyle: LineStyle.LargeDashed,
                        axisLabelVisible: true,
                        title: '손절 (보정)',
                    })
                );
            }
            for (const tp of reconciledPrices.takeProfitPrices) {
                const title =
                    tp.totalCount > 1
                        ? `#${tp.index + 1} 청산 (보정)`
                        : '목표가 (보정)';
                reconciledLines.push(
                    series.createPriceLine({
                        price: tp.price,
                        color: RECONCILED_TAKE_PROFIT_COLOR,
                        lineWidth,
                        lineStyle: LineStyle.LargeDashed,
                        axisLabelVisible: true,
                        title,
                    })
                );
            }
        }

        priceLinesRef.current = [
            ...entryLines,
            ...stopLossLine,
            ...takeProfitLines,
            ...reconciledLines,
        ];
    }, [actionPrices, reconciledPrices, isVisible, lineWidth, seriesRef]);
}
