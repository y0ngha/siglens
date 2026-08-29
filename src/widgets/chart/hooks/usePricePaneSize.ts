'use client';

import type { RefObject } from 'react';
import { useEffect, useState } from 'react';
import type { IChartApi } from 'lightweight-charts';
import type { PaneIndices } from '../types';

export interface PricePaneSize {
    /** 차트 컨테이너 폭. 가격 축까지 포함한 값이라 소비처가 축 자리를 빼서 쓴다. */
    width: number;
    /** pane 0(가격 pane)의 높이. 보조 pane 개수에 따라 바뀐다. */
    height: number;
}

const UNMEASURED: PricePaneSize = { width: 0, height: 0 };

/**
 * 가격 pane의 크기를 추적한다. 오버레이 범례가 자기 pane을 넘지 않도록
 * 상한을 계산하는 데 쓴다.
 *
 * `usePaneLabels`와 같은 관찰 전략을 쓴다: wrapper 자체는 pane 재분배로
 * 크기가 변하지 않으므로 ResizeObserver가 발화하지 않는다. LWC가 pane마다
 * 별도 canvas를 그리므로 **내부 canvas들을 직접 관찰**해야 pane 높이 변화를
 * 잡을 수 있다. pane 추가·제거 직후에는 아직 높이가 갱신되지 않았을 수 있어
 * 다음 프레임에 한 번 더 잰다.
 */
export function usePricePaneSize(
    chartRef: RefObject<IChartApi | null>,
    containerRef: RefObject<HTMLDivElement | null>,
    paneIndices: PaneIndices
): PricePaneSize {
    const [size, setSize] = useState<PricePaneSize>(UNMEASURED);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const measure = (): void => {
            const chart = chartRef.current;
            const height = chart?.panes()[0]?.getHeight() ?? 0;
            const width = container.clientWidth;
            // 같은 값이면 새 객체를 만들지 않는다 — ResizeObserver 콜백에서
            // 무조건 setState하면 관찰 루프 경고가 난다.
            setSize(prev =>
                prev.width === width && prev.height === height
                    ? prev
                    : { width, height }
            );
        };

        const rafId = requestAnimationFrame(measure);
        const observer = new ResizeObserver(measure);

        observer.observe(container);
        for (const canvas of container.querySelectorAll('canvas')) {
            observer.observe(canvas);
        }

        return () => {
            cancelAnimationFrame(rafId);
            observer.disconnect();
        };
    }, [chartRef, containerRef, paneIndices]);

    return size;
}
