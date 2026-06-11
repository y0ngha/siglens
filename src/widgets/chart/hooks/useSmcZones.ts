'use client';

import type { RefObject } from 'react';
import { useEffect, useRef } from 'react';
import type {
    IPriceLine,
    ISeriesApi,
    LineWidth,
    UTCTimestamp,
} from 'lightweight-charts';
import { LineStyle } from 'lightweight-charts';
import type { SMCResult } from '@y0ngha/siglens-core';
import { DEFAULT_LINE_WIDTH } from '../constants';
import { buildSmcZoneLines } from '../utils/smcZoneUtils';

interface UseSmcZonesParams {
    seriesRef: RefObject<ISeriesApi<'Candlestick', UTCTimestamp> | null>;
    smc: SMCResult | undefined;
    isVisible: boolean;
    lineWidth?: LineWidth;
}

export function useSmcZones({
    seriesRef,
    smc,
    isVisible,
    lineWidth = DEFAULT_LINE_WIDTH,
}: UseSmcZonesParams): void {
    const priceLinesRef = useRef<IPriceLine[]>([]);

    useEffect(() => {
        const series = seriesRef.current;

        priceLinesRef.current.forEach(pl => series?.removePriceLine(pl));
        priceLinesRef.current = [];

        if (!series || !isVisible) return;

        const lines = buildSmcZoneLines(smc);
        if (lines.length === 0) return;

        priceLinesRef.current = lines.map(line =>
            series.createPriceLine({
                price: line.price,
                color: line.color,
                lineWidth,
                lineStyle: LineStyle.Dashed,
                // 대표선(title 있음)만 축 라벨 표시 — 밴드 하단선 라벨 중복으로 축 혼잡해지는 것 방지.
                axisLabelVisible: line.title !== '',
                title: line.title,
            })
        );
    }, [smc, isVisible, lineWidth, seriesRef]);
}
