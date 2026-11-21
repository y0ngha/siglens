'use client';

import type { FearGreedHistoryPoint } from '@y0ngha/siglens-core';
import { useTranslations } from 'next-intl';
import { FEAR_GREED_CHART_HEIGHT } from './constants';
import { useFearGreedLineChart } from './hooks/useFearGreedLineChart';
import { chartWindow } from './utils/chartWindow';

interface FearGreedHistoricalChartProps {
    history: FearGreedHistoryPoint[];
}

/**
 * 공포·탐욕 점수 선 차트의 자리(최근 252점). 차트 생성·데이터 갱신은 `useFearGreedLineChart`가
 * 맡고, 여기서는 컨테이너와 접근성 이름만 둔다. 이름의 기간은 그려지는 점이 실제로 걸친
 * 기간이다 — 252점은 주식에서 1년, 암호화폐에서 약 8개월이다(`chartWindow`).
 */
export function FearGreedHistoricalChart({
    history,
}: FearGreedHistoricalChartProps) {
    const t = useTranslations('widgets.chart');
    const containerRef = useFearGreedLineChart(history);
    const range = chartWindow(history);

    return (
        <div
            ref={containerRef}
            // 차트가 그려지기 전에도 높이를 잡아 둔다 — 차트 생성 옵션과 같은 상수다.
            className="w-full"
            style={{ height: FEAR_GREED_CHART_HEIGHT }}
            role="img"
            aria-label={
                range.kind === 'year'
                    ? t('FearGreedHistoricalChart.9b98f6')
                    : t('FearGreedHistoricalChart.ariaMonths', {
                          months: range.months,
                      })
            }
        />
    );
}
