'use client';

import { useMemo } from 'react';
import {
    type OptionsSnapshot,
    summarizeChainForLlm,
} from '@y0ngha/siglens-core';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { pickActiveChain } from '@/components/options/utils/pickActiveChain';
import {
    formatAtmIv,
    formatImpliedMove,
    formatMaxPain,
    formatPutCallRatio,
} from '@/components/options/utils/optionsFormatters';

interface OptionsMetricsRowProps {
    /** 'YYYY-MM-DD' or 'all'. */
    expirationDate: string | 'all';
    /** Pre-fetched snapshot from the parent (HydrationBoundary-prefilled). */
    snapshot: OptionsSnapshot;
}

const MaxPainTooltip = (
    <>
        <p>옵션 만기일이 가까워질수록 주가가 끌리는 가격이에요.</p>
        <p>
            옵션을 판 쪽(주로 기관)의 손실이 가장 적어지는 가격이라, 만기일
            부근에는 주가가 이쪽으로 움직이는 경향이 있어요.
        </p>
        <p>절대 법칙은 아니고 참고용 가격으로 보세요.</p>
    </>
);

const PutCallRatioTooltip = (
    <>
        <p>풋옵션 거래량을 콜옵션 거래량으로 나눈 값이에요.</p>
        <p>
            1보다 크면 풋(하락 베팅)이 더 많아 시장이 조심스럽다는 뜻이고, 1보다
            작으면 콜(상승 베팅)이 더 많다는 뜻이에요.
        </p>
        <p>
            너무 극단으로 치우치면 오히려 반대 신호로 해석하는 경우도 많아요 —
            모두 두려워할 때가 바닥인 경우가 있거든요.
        </p>
    </>
);

const AtmIvTooltip = (
    <>
        <p>현재 주가에 가장 가까운 옵션이 반영하고 있는 예상 변동성이에요.</p>
        <p>어닝 발표 직전에 보통 올라가요.</p>
    </>
);

const ImpliedMoveTooltip = (
    <>
        <p>
            옵션 시장이 &ldquo;이 주식이 앞으로 얼마나 출렁일 것 같다&rdquo;고
            가격에 반영해놓은 폭이에요.
        </p>
        <p>
            예를 들어 ±4%라면 시장은 다음 만기일까지 주가가 ±4% 정도 움직일
            가능성이 높다고 보고 있는 거예요.
        </p>
        <p>어닝 같은 큰 이벤트 직전에는 이 값이 평소보다 커져요.</p>
    </>
);

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
    const nearestExpiry = snapshot.chains[0]?.expirationDate ?? '';
    const metrics = useMemo(
        () =>
            selectedChain
                ? summarizeChainForLlm(selectedChain, snapshot.underlyingPrice)
                : null,
        [selectedChain, snapshot.underlyingPrice]
    );

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
