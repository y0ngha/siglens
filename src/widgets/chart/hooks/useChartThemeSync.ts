'use client';

import { useEffect } from 'react';
import type { IChartApi } from 'lightweight-charts';
import { getChartChrome } from '@/shared/lib/chartColors';

/**
 * 테마 전환 시 차트 크롬(배경·그리드·축 텍스트)만 갈아끼운다.
 *
 * **차트를 리마운트하지 않는 것이 핵심이다.** 리마운트하면 사용자의 스크롤·줌
 * 위치가 날아가고, 지표 오버레이 훅이 전부 다시 돌며, 이 페이지 LCP를 지배하는
 * 하이드레이션 인접 작업이 재실행된다. `applyOptions`는 캔버스만 다시 그린다.
 *
 * `siglens:themechange`는 `useTheme`의 `applyTheme`이 쏘는 커스텀 이벤트다.
 * 시스템 선호도 변경도 그 경로를 타므로 여기서 별도로 matchMedia를 듣지 않는다.
 */
export function useChartThemeSync(
    chartRef: React.RefObject<IChartApi | null>
): void {
    useEffect(() => {
        const apply = () => {
            const chart = chartRef.current;
            if (!chart) return;
            const chrome = getChartChrome();
            chart.applyOptions({
                layout: {
                    background: { color: chrome.background },
                    textColor: chrome.text,
                },
                grid: {
                    vertLines: { color: chrome.grid },
                    horzLines: { color: chrome.grid },
                },
            });
        };
        window.addEventListener('siglens:themechange', apply);
        return () => window.removeEventListener('siglens:themechange', apply);
    }, [chartRef]);
}
