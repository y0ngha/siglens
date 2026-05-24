'use client';

import { useMemo } from 'react';
import type { OptionsExpirationMetrics } from '@y0ngha/siglens-core';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import type { OptionsExpirationSelector } from '@/shared/lib/types';
import {
    formatAtmIv,
    formatImpliedMove,
    formatMaxPain,
    formatPutCallRatio,
    METRIC_PLACEHOLDER,
} from '@/lib/options/optionsFormatters';
import {
    AtmIvTooltip,
    ImpliedMoveTooltip,
    MaxPainTooltip,
    PutCallRatioTooltip,
} from './utils/optionsTooltips';

interface MetricCardProps {
    label: string;
    value: string;
    tooltip: React.ReactNode;
}

function MetricCard({ label, value, tooltip }: MetricCardProps) {
    return (
        <div className="border-secondary-700 bg-secondary-800 rounded-xl border p-4">
            <div className="flex items-center">
                <span className="text-secondary-400 text-xs tracking-widest uppercase">
                    {label}
                </span>
                <InfoTooltip>{tooltip}</InfoTooltip>
            </div>
            <p className="text-secondary-100 mt-1 font-mono text-xl font-semibold tabular-nums">
                {value}
            </p>
        </div>
    );
}

interface OptionsMetricsRowProps {
    /** 'YYYY-MM-DD' or 'all'. */
    expirationDate: OptionsExpirationSelector;
    /** Pre-computed metrics from the parent (shared with chart/table). */
    metrics: OptionsExpirationMetrics | null;
    /** First-chain expiration date for the "종합 만기" caption. */
    nearestExpiry: string;
    /**
     * `true`이면 OI 스냅샷이 stale 상태(Yahoo 정규장 외 quote 클리어)로 판정되어
     * 카드의 모든 metric을 EM DASH로 표시한다. Max Pain·ATM IV·Imp. Move는
     * OI/IV에 직접 의존하므로 stale 데이터로 계산하면 사용자에게 잘못된 숫자
     * (예: $50, 0.0%)를 신뢰성 있게 보이도록 노출하게 된다.
     */
    oiStale: boolean;
}

export function OptionsMetricsRow({
    expirationDate,
    metrics,
    nearestExpiry,
    oiStale,
}: OptionsMetricsRowProps) {
    // siglens-core R12: maxPain / putCallRatio are now `number | null`
    // (formatters tolerate the union explicitly), so pass through directly
    // without the legacy `?? NaN` coercion.
    const metricCards = useMemo(
        () =>
            [
                {
                    label: 'Max Pain',
                    value: oiStale
                        ? METRIC_PLACEHOLDER
                        : formatMaxPain(metrics?.maxPain ?? null),
                    tooltip: MaxPainTooltip,
                },
                {
                    label: 'P/C Ratio',
                    value: oiStale
                        ? METRIC_PLACEHOLDER
                        : formatPutCallRatio(metrics?.putCallRatio ?? null),
                    tooltip: PutCallRatioTooltip,
                },
                {
                    label: 'ATM IV',
                    value: oiStale
                        ? METRIC_PLACEHOLDER
                        : formatAtmIv(metrics?.atmImpliedVolatility ?? null),
                    tooltip: <AtmIvTooltip />,
                },
                {
                    label: 'Imp. Move',
                    value: oiStale
                        ? METRIC_PLACEHOLDER
                        : formatImpliedMove(
                              metrics?.impliedMovePercent ?? null
                          ),
                    tooltip: <ImpliedMoveTooltip />,
                },
            ] as const,
        [metrics, oiStale]
    );

    return (
        <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {metricCards.map(({ label, value, tooltip }) => (
                    <MetricCard
                        key={label}
                        label={label}
                        value={value}
                        tooltip={tooltip}
                    />
                ))}
            </div>
            {expirationDate === 'all' && nearestExpiry && (
                <p className="text-secondary-500 text-[10px]">
                    전체 만기 합산 — 가장 가까운 만기({nearestExpiry}) 기준으로
                    표시합니다.
                </p>
            )}
        </div>
    );
}
