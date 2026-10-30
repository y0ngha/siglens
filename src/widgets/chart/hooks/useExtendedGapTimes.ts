'use client';

/**
 * 시간외 봉 시각을 지표 차트 어댑터에 알려, 지표 선이 시간외 구간에서 끊기게 하는 훅.
 */
import { useEffect, useMemo } from 'react';
import type { Bar } from '@y0ngha/siglens-core';
import type { ExtendedGapController } from '../utils/extendedGapChart';

/** 시간외 시각마다 지표 선을 끊는다(`extendedGapChart` JSDoc). 이미 그려진 시리즈도 다시 채운다. */
export function useExtendedGapTimes(
    gapController: ExtendedGapController,
    extendedBars: readonly Bar[]
): void {
    const gapTimes = useMemo(
        () => extendedBars.map(b => b.time),
        [extendedBars]
    );
    useEffect(() => {
        gapController.setGapTimes(gapTimes);
    }, [gapController, gapTimes]);
}
