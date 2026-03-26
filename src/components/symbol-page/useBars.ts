'use client';

import { useCallback, useRef, useState } from 'react';
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
    barsError: string | null;
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
    const isLoadingBarsRef = useRef(false);
    const timeframeRef = useRef<Timeframe>(DEFAULT_TIMEFRAME);
    const [barsError, setBarsError] = useState<string | null>(null);

    const handleTimeframeChange = useCallback(
        async (nextTimeframe: Timeframe): Promise<void> => {
            if (
                nextTimeframe === timeframeRef.current ||
                isLoadingBarsRef.current
            )
                return;
            isLoadingBarsRef.current = true;
            setIsLoadingBars(true);
            setBarsError(null);

            try {
                const limit = TIMEFRAME_BARS_LIMIT[nextTimeframe];
                const res = await fetch(
                    `/api/bars?symbol=${encodeURIComponent(symbol)}&timeframe=${nextTimeframe}&limit=${limit}`
                );
                if (!res.ok) {
                    // 요청 실패 시 에러 상태를 노출하고 기존 데이터를 유지한다.
                    setBarsError(
                        `데이터를 불러오지 못했습니다 (${res.status})`
                    );
                    return;
                }

                const data: BarsResponse = await res.json();
                const nextBars = data.bars;
                const nextIndicators = calculateIndicators(nextBars);

                timeframeRef.current = nextTimeframe;
                setTimeframe(nextTimeframe);
                setBars(nextBars);
                setIndicators(nextIndicators);
            } catch (_err) {
                setBarsError('데이터를 불러오지 못했습니다');
            } finally {
                isLoadingBarsRef.current = false;
                setIsLoadingBars(false);
            }
        },
        [symbol]
    );

    return {
        bars,
        indicators,
        timeframe,
        isLoadingBars,
        barsError,
        handleTimeframeChange,
    };
}
