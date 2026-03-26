'use client';

import { useState } from 'react';
import { calculateIndicators } from '@/domain/indicators';
import type {
    Bar,
    BarsResponse,
    IndicatorResult,
    Timeframe,
} from '@/domain/types';
import {
    DEFAULT_TIMEFRAME,
    TIMEFRAME_BARS_LIMIT,
} from '@/domain/constants/market';

interface UseBarsOptions {
    symbol: string;
    initialBars: Bar[];
    initialIndicators: IndicatorResult;
}

interface UseBarsResult {
    bars: Bar[];
    indicators: IndicatorResult;
    timeframe: Timeframe;
    isLoadingBars: boolean;
    handleTimeframeChange: (nextTimeframe: Timeframe) => Promise<void>;
}

export function useBars({
    symbol,
    initialBars,
    initialIndicators,
}: UseBarsOptions): UseBarsResult {
    const [timeframe, setTimeframe] = useState<Timeframe>(DEFAULT_TIMEFRAME);
    const [bars, setBars] = useState<Bar[]>(initialBars);
    const [indicators, setIndicators] =
        useState<IndicatorResult>(initialIndicators);
    const [isLoadingBars, setIsLoadingBars] = useState(false);

    const handleTimeframeChange = async (
        nextTimeframe: Timeframe
    ): Promise<void> => {
        if (nextTimeframe === timeframe) return;
        setIsLoadingBars(true);

        try {
            const limit = TIMEFRAME_BARS_LIMIT[nextTimeframe];
            const res = await fetch(
                `/api/bars?symbol=${encodeURIComponent(symbol)}&timeframe=${nextTimeframe}&limit=${limit}`
            );
            if (!res.ok) return;

            const data: BarsResponse = await res.json();
            const nextBars = data.bars;
            const nextIndicators = calculateIndicators(nextBars);

            setTimeframe(nextTimeframe);
            setBars(nextBars);
            setIndicators(nextIndicators);
        } finally {
            setIsLoadingBars(false);
        }
    };

    return {
        bars,
        indicators,
        timeframe,
        isLoadingBars,
        handleTimeframeChange,
    };
}
