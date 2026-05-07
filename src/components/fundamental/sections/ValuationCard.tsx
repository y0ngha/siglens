'use client';

import type { FundamentalValuationMetrics } from '@y0ngha/siglens-core';
import { InfoTooltip } from '@/components/ui/InfoTooltip';

interface ValuationCardProps {
    metrics: FundamentalValuationMetrics;
}

interface MetricRowProps {
    label: string;
    value: number | null;
    description: string;
    digits?: number;
    tooltip?: string;
}

function MetricRow({ label, value, description, digits = 2, tooltip }: MetricRowProps) {
    const formatted =
        value !== null
            ? new Intl.NumberFormat('ko-KR', {
                  maximumFractionDigits: digits,
              }).format(value)
            : '—';

    return (
        <div className="border-secondary-700 flex items-baseline justify-between gap-4 border-b py-2.5 last:border-b-0">
            <div>
                <span className="text-sm font-medium" translate="no">
                    {label}
                </span>
                {tooltip !== undefined && <InfoTooltip>{tooltip}</InfoTooltip>}
                <span className="text-secondary-400 ml-1.5 text-xs">
                    {description}
                </span>
            </div>
            <span className="font-mono text-sm font-medium tabular-nums">
                {formatted}
            </span>
        </div>
    );
}

export function ValuationCard({ metrics }: ValuationCardProps) {
    return (
        <section
            aria-labelledby="valuation-heading"
            className="border-secondary-700 bg-secondary-800 rounded-xl border p-6"
        >
            <h2
                id="valuation-heading"
                className="mb-4 text-lg font-semibold tracking-tight"
            >
                밸류에이션
            </h2>
            <div>
                <MetricRow
                    label="PER"
                    value={metrics.peRatioTTM}
                    description="주가수익비율 (TTM)"
                    digits={1}
                    tooltip="주가수익비율. 주가 ÷ 주당순이익. 낮을수록 저평가 가능성"
                />
                <MetricRow
                    label="PSR"
                    value={metrics.priceToSalesRatioTTM}
                    description="주가매출비율 (TTM)"
                    tooltip="주가매출비율. 성장주·적자기업 평가에 주로 사용"
                />
                <MetricRow
                    label="PBR"
                    value={metrics.pbRatioTTM}
                    description="주가순자산비율 (TTM)"
                    tooltip="주가순자산비율. 1 미만이면 장부가 이하 거래"
                />
                <MetricRow
                    label="PEG"
                    value={metrics.pegRatioTTM}
                    description="성장가치비율 (TTM)"
                    tooltip="성장가치비율. PER ÷ 이익성장률. 1 미만이면 성장 대비 저평가"
                />
                <MetricRow
                    label="EV/EBITDA"
                    value={metrics.enterpriseValueOverEBITDATTM}
                    description="기업가치/EBITDA (TTM)"
                    digits={1}
                    tooltip="기업 전체 가치(부채 포함) ÷ 세전이익·감가상각 전이익"
                />
                <MetricRow
                    label="EPS"
                    value={metrics.epsTTM}
                    description="주당순이익 (TTM)"
                    tooltip="주당순이익. 순이익 ÷ 발행주식수"
                />
            </div>
        </section>
    );
}
