/**
 * 축 카드의 핵심 지표 한 줄 — 라벨과 단위별로 포맷한 값.
 */
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import type { ScoreMetric } from '@y0ngha/siglens-core';
import { formatMetricValue } from '../../utils/metricFormat';
import type { StatementCurrency } from '../../utils/statementCurrency';

interface MetricRowProps {
    metric: ScoreMetric;
    currency: StatementCurrency;
}

/** 지표 라벨은 core가 주는 한국어를 그대로 쓴다 — 안정 키가 없다. */
export function MetricRow({ metric, currency }: MetricRowProps) {
    const locale = useResolvedLocale();
    return (
        <div className="flex items-baseline justify-between gap-2 border-b border-secondary-700 py-1.5 last:border-b-0">
            <span className="text-xs text-secondary-300">{metric.labelKo}</span>
            <span className="font-mono text-xs font-medium tabular-nums">
                {formatMetricValue(metric.value, metric.unit, currency, locale)}
            </span>
        </div>
    );
}
