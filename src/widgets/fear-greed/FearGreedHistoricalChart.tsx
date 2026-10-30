'use client';

import type { FearGreedHistoryPoint } from '@y0ngha/siglens-core';
import { useTranslations } from 'next-intl';
import { FEAR_GREED_CHART_HEIGHT } from './constants';
import { useFearGreedLineChart } from './hooks/useFearGreedLineChart';

interface FearGreedHistoricalChartProps {
    history: FearGreedHistoryPoint[];
}

/**
 * 최근 1년 공포·탐욕 점수 선 차트의 자리. 차트 생성·데이터 갱신은 `useFearGreedLineChart`가
 * 맡고, 여기서는 컨테이너와 접근성 이름만 둔다.
 */
export function FearGreedHistoricalChart({
    history,
}: FearGreedHistoricalChartProps) {
    const t = useTranslations('widgets.chart');
    const containerRef = useFearGreedLineChart(history);

    return (
        <div
            ref={containerRef}
            // 차트가 그려지기 전에도 높이를 잡아 둔다 — 차트 생성 옵션과 같은 상수다.
            className="w-full"
            style={{ height: FEAR_GREED_CHART_HEIGHT }}
            role="img"
            aria-label={t('FearGreedHistoricalChart.9b98f6')}
        />
    );
}
