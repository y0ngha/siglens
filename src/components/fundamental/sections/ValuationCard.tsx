import type { ReactNode } from 'react';
import type { FundamentalValuationMetrics } from '@y0ngha/siglens-core';
import { EmptySectionCard } from '@/components/fundamental/sections/EmptySectionCard';
import { InfoTooltip } from '@/components/ui/InfoTooltip';

const HEADING_ID = 'valuation-heading';
const HEADING_CLASS_NAME = 'mb-4 text-lg font-semibold tracking-tight';

interface ValuationCardProps {
    metrics: FundamentalValuationMetrics | null;
}

interface MetricRowProps {
    label: string;
    value: number | null;
    description: string;
    digits?: number;
    tooltip?: ReactNode;
}

function MetricRow({
    label,
    value,
    description,
    digits = 2,
    tooltip,
}: MetricRowProps) {
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
    if (metrics === null) {
        return (
            <EmptySectionCard
                headingId={HEADING_ID}
                title="밸류에이션"
                headingClassName={HEADING_CLASS_NAME}
            />
        );
    }

    return (
        <section
            aria-labelledby={HEADING_ID}
            className="border-secondary-700 bg-secondary-800 rounded-xl border p-6"
        >
            <h2 id={HEADING_ID} className={HEADING_CLASS_NAME}>
                밸류에이션
            </h2>
            <div>
                <MetricRow
                    label="PER"
                    value={metrics.peRatioTTM}
                    description="주가수익비율 (TTM)"
                    digits={1}
                    tooltip={
                        <>
                            <p>
                                현재 주가가 1년치 이익의 몇 배인지 보여주는
                                값이에요.
                            </p>
                            <p>보통 낮을수록 저평가, 높을수록 고평가로 봐요.</p>
                            <p>같은 업종 평균과 비교하는 게 가장 정확해요.</p>
                        </>
                    }
                />
                <MetricRow
                    label="PSR"
                    value={metrics.priceToSalesRatioTTM}
                    description="주가매출비율 (TTM)"
                    tooltip={
                        <>
                            <p>주가가 매출의 몇 배인지 보여주는 값이에요.</p>
                            <p>
                                아직 이익이 적은 성장주나 적자 기업을 평가할 때
                                자주 써요.
                            </p>
                            <p>
                                보통 1 이하면 매출 대비 저평가, 5 이상이면
                                고평가로 봐요.
                            </p>
                        </>
                    }
                />
                <MetricRow
                    label="PBR"
                    value={metrics.pbRatioTTM}
                    description="주가순자산비율 (TTM)"
                    tooltip={
                        <>
                            <p>
                                주가가 회사가 가진 순자산의 몇 배인지 보여주는
                                값이에요.
                            </p>
                            <p>
                                1 미만이면 회사 자산보다 싸게 거래되고 있다는
                                뜻이에요.
                            </p>
                            <p>
                                1 이상이면 자산 가치 이상으로 평가받고 있다는
                                뜻이에요.
                            </p>
                        </>
                    }
                />
                <MetricRow
                    label="PEG"
                    value={metrics.pegRatioTTM}
                    description="성장가치비율 (TTM)"
                    tooltip={
                        <>
                            <p>PER에 이익 성장률까지 함께 본 값이에요.</p>
                            <p>
                                1 미만이면 성장성 대비 저평가, 1 이상이면 성장
                                대비 고평가예요.
                            </p>
                        </>
                    }
                />
                <MetricRow
                    label="EV/EBITDA"
                    value={metrics.enterpriseValueOverEBITDATTM}
                    description="기업가치/EBITDA (TTM)"
                    digits={1}
                    tooltip={
                        <>
                            <p>
                                빚까지 포함한 기업 전체 가치를 영업이익(감가상각
                                전 기준)으로 나눈 값이에요.
                            </p>
                            <p>
                                인수·합병이나 기업 간 비교에서 자주 쓰고,
                                낮을수록 저렴하다고 봐요.
                            </p>
                        </>
                    }
                />
                <MetricRow
                    label="EPS"
                    value={metrics.epsTTM}
                    description="주당순이익 (TTM)"
                    tooltip={
                        <>
                            <p>
                                회사가 1년간 번 순이익을 1주당 얼마 벌었는지로
                                환산한 값이에요.
                            </p>
                            <p>
                                클수록 주식 1주가 더 많은 이익을 만들어내고
                                있다는 뜻이에요.
                            </p>
                        </>
                    }
                />
            </div>
        </section>
    );
}
