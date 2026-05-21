'use client';

import { useMemo } from 'react';
import type { OptionsExpirationMetrics } from '@y0ngha/siglens-core';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import type { OptionsExpirationSelector } from '@/domain/types';
import {
    formatAtmIv,
    formatImpliedMove,
    formatMaxPain,
    formatPutCallRatio,
} from '@/lib/options/optionsFormatters';
import {
    AtmIvTooltip,
    ImpliedMoveTooltip,
    MaxPainTooltip,
    PutCallRatioTooltip,
} from '@/components/options/utils/optionsTooltips';

interface OptionsMetricsRowProps {
    /** 'YYYY-MM-DD' or 'all'. */
    expirationDate: OptionsExpirationSelector;
    /** Pre-computed metrics from the parent (shared with chart/table). */
    metrics: OptionsExpirationMetrics | null;
    /** First-chain expiration date for the "종합 만기" caption. */
    nearestExpiry: string;
}

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

export function OptionsMetricsRow({
    expirationDate,
    metrics,
    nearestExpiry,
}: OptionsMetricsRowProps) {
    // siglens-core R12: maxPain / putCallRatio are now `number | null`
    // (formatters tolerate the union explicitly), so pass through directly
    // without the legacy `?? NaN` coercion.
    const metricCards = useMemo(
        () =>
            [
                {
                    label: 'Max Pain',
                    value: formatMaxPain(metrics?.maxPain ?? null),
                    tooltip: MaxPainTooltip,
                },
                {
                    label: 'P/C Ratio',
                    value: formatPutCallRatio(metrics?.putCallRatio ?? null),
                    tooltip: PutCallRatioTooltip,
                },
                {
                    label: 'ATM IV',
                    value: formatAtmIv(metrics?.atmImpliedVolatility ?? null),
                    tooltip: AtmIvTooltip,
                },
                {
                    label: 'Imp. Move',
                    value: formatImpliedMove(
                        metrics?.impliedMovePercent ?? null
                    ),
                    tooltip: ImpliedMoveTooltip,
                },
            ] as const,
        [metrics]
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
                    종합 만기 기준 — 가장 가까운 만기 데이터를 표시합니다 (
                    {nearestExpiry}).
                </p>
            )}
        </div>
    );
}
