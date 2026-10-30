'use client';

/**
 * 캔들 시리즈 데이터 동기화와 시간축 맞춤 훅 — 봉이 바뀌면 캔들을 다시 채우고, 정규장 봉이
 * 바뀔 때만 맞춘다(시간외 봉만 늦게 도착하면 사용자가 보던 자리를 지킨다).
 */
import { type RefObject, useEffect, useRef } from 'react';
import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import type { Bar, ImpulseColor } from '@y0ngha/siglens-core';
import { buildCandlestickDataWithExtended } from '../utils/extendedBarsDisplay';
import {
    restoreVisibleView,
    snapshotVisibleView,
    type VisibleViewSnapshot,
} from '../utils/visibleViewSnapshot';

interface UseCandlestickDataParams {
    chartRef: RefObject<IChartApi | null>;
    seriesRef: RefObject<ISeriesApi<'Candlestick', UTCTimestamp> | null>;
    /** 정규장 봉. */
    bars: Bar[];
    /** 프리·애프터마켓 봉. */
    extendedBars: Bar[];
    elderImpulse: (ImpulseColor | null)[];
    /** Elder Impulse 색을 캔들에 입힐지. */
    showElderImpulse: boolean;
    /** 사용자가 두 차트 중 어느 쪽이든 밀거나 확대했는가(`useChartSync.isUserAdjustedView`). */
    isViewAdjusted?: () => boolean;
    /** 맞춤이 새로 일어나 조정 기록을 지울 때 부른다(`useChartSync.resetUserAdjustedView`). */
    onViewAdjustmentReset?: () => void;
}

/** 캔들 데이터를 채우고, 정규장 봉이 바뀔 때만 시간축을 맞춘다(아니면 보던 자리 복원). */
export function useCandlestickData({
    chartRef,
    seriesRef,
    bars,
    extendedBars,
    elderImpulse,
    showElderImpulse,
    isViewAdjusted,
    onViewAdjustmentReset,
}: UseCandlestickDataParams): void {
    // 데이터를 바꾸기 직전의 보던 자리(`snapshotVisibleView` JSDoc).
    const viewBeforeDataRef = useRef<VisibleViewSnapshot | null>(null);
    const lastFitBarsRef = useRef<Bar[] | null>(null);
    const callbacksRef = useRef({ isViewAdjusted, onViewAdjustmentReset });
    useEffect(() => {
        callbacksRef.current = { isViewAdjusted, onViewAdjustmentReset };
    });

    useEffect(() => {
        if (!seriesRef.current || !chartRef.current) return;

        // setData가 보이는 범위를 동기로 밀어내므로 그 전에 보던 자리를 찍어 둔다.
        viewBeforeDataRef.current = snapshotVisibleView(
            chartRef.current.timeScale()
        );
        seriesRef.current.setData(
            buildCandlestickDataWithExtended(
                bars,
                extendedBars,
                elderImpulse,
                showElderImpulse
            )
        );
    }, [
        chartRef,
        seriesRef,
        bars,
        extendedBars,
        elderImpulse,
        showElderImpulse,
    ]);

    // 시간축 맞춤. 정규장 봉(`bars`)이 바뀌거나(데이터 로드·심볼·타임프레임·새로고침) 첫 렌더면 맞춘다 — Elder
    // Impulse 토글로 setData가 재실행돼도 줌·스크롤이 초기화되지 않도록 의존성은 봉 배열뿐이다.
    // 시간외 봉만 **나중에** 도착·토글된 경우(`bars` 동일)에는, 사용자가 이미 밀거나 확대했다면 맞추지 않고
    // 보던 시간 범위를 그대로 복원한다(같은 정규장 봉이 계속 화면에 있다). 사용자가 건드리지 않았다면 맞춘다.
    useEffect(() => {
        const chart = chartRef.current;
        if (!chart) return;
        const previous = lastFitBarsRef.current;
        const regularChanged = previous !== bars;
        lastFitBarsRef.current = bars;
        const view = viewBeforeDataRef.current;
        const { isViewAdjusted: isAdjusted, onViewAdjustmentReset: reset } =
            callbacksRef.current;
        if (
            previous !== null &&
            !regularChanged &&
            isAdjusted?.() === true &&
            view !== null &&
            restoreVisibleView(chart.timeScale(), view)
        ) {
            return;
        }
        if (regularChanged) reset?.();
        chart.timeScale().fitContent();
        // 의존성은 **그려지는 봉을 바꾸는 두 입력**이다: 정규장 봉(`bars`)과 시간외 봉(`extendedBars`, 도착·토글).
        // `extendedBars`는 본문이 읽지 않고 재실행 트리거로만 쓴다.
    }, [chartRef, bars, extendedBars]);
}
