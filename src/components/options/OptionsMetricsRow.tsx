'use client';

import { useMemo } from 'react';
import {
    type OptionsSnapshot,
    summarizeChainForLlm,
} from '@y0ngha/siglens-core';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { pickActiveChain } from '@/domain/options/pickActiveChain';
import type { OptionsExpirationSelector } from '@/domain/options/types';
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
} from '@/lib/options/optionsTooltips';

interface OptionsMetricsRowProps {
    /** 'YYYY-MM-DD' or 'all'. */
    expirationDate: OptionsExpirationSelector;
    /** Pre-fetched snapshot from the parent (HydrationBoundary-prefilled). */
    snapshot: OptionsSnapshot;
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
    snapshot,
}: OptionsMetricsRowProps) {
    const selectedChain = useMemo(
        () => pickActiveChain(snapshot, expirationDate),
        [snapshot, expirationDate]
    );
    const metrics = useMemo(
        () =>
            selectedChain
                ? summarizeChainForLlm(selectedChain, snapshot.underlyingPrice)
                : null,
        [selectedChain, snapshot.underlyingPrice]
    );
    const nearestExpiry = snapshot.chains[0]?.expirationDate ?? '';

    const maxPainValue = formatMaxPain(metrics?.maxPain ?? NaN);
    const pcRatioValue = formatPutCallRatio(metrics?.putCallRatio ?? NaN);
    const atmIvValue = formatAtmIv(metrics?.atmImpliedVolatility ?? null);
    const impliedMoveValue = formatImpliedMove(
        metrics?.impliedMovePercent ?? null
    );

    return (
        <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MetricCard
                    label="Max Pain"
                    value={maxPainValue}
                    tooltip={MaxPainTooltip}
                />
                <MetricCard
                    label="P/C Ratio"
                    value={pcRatioValue}
                    tooltip={PutCallRatioTooltip}
                />
                <MetricCard
                    label="ATM IV"
                    value={atmIvValue}
                    tooltip={AtmIvTooltip}
                />
                <MetricCard
                    label="Imp. Move"
                    value={impliedMoveValue}
                    tooltip={ImpliedMoveTooltip}
                />
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
