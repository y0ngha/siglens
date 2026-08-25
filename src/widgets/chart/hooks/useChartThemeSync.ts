'use client';

import { useEffect } from 'react';
import type { IChartApi } from 'lightweight-charts';
import { getChartChrome } from '@/shared/lib/chartColors';
import { THEME_CHANGE_EVENT } from '@/shared/lib/theme';

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
    chartRef: React.RefObject<IChartApi | null>,
    options?: {
        /**
         * 배경을 투명하게 두는 차트용. 부모 표면 색을 그대로 비쳐야 하는
         * 차트(예: 카드 안에 얹힌 공포탐욕 히스토리)는 배경을 덮어쓰면
         * 카드 위에 불투명 사각형이 생긴다. 텍스트·그리드만 갱신한다.
         */
        readonly keepBackground?: boolean;
    }
): void {
    const keepBackground = options?.keepBackground ?? false;

    useEffect(() => {
        const apply = () => {
            const chart = chartRef.current;
            if (!chart) return;
            const chrome = getChartChrome();
            chart.applyOptions({
                layout: {
                    ...(keepBackground
                        ? {}
                        : { background: { color: chrome.background } }),
                    textColor: chrome.text,
                },
                grid: {
                    vertLines: { color: chrome.grid },
                    horzLines: { color: chrome.grid },
                },
            });
        };
        window.addEventListener(THEME_CHANGE_EVENT, apply);
        return () => window.removeEventListener(THEME_CHANGE_EVENT, apply);
    }, [chartRef, keepBackground]);
}
