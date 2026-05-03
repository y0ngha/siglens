import type { FundamentalValuationMetrics } from '@y0ngha/siglens-core';

interface ValuationCardProps {
    metrics: FundamentalValuationMetrics;
}

interface MetricRowProps {
    label: string;
    value: number | null;
    description: string;
    digits?: number;
}

function MetricRow({ label, value, description, digits = 2 }: MetricRowProps) {
    const formatted =
        value !== null
            ? new Intl.NumberFormat('ko-KR', {
                  maximumFractionDigits: digits,
              }).format(value)
            : '—';

    return (
        <div className="border-border flex items-baseline justify-between gap-4 border-b py-2.5 last:border-b-0">
            <div>
                <span className="text-sm font-medium" translate="no">
                    {label}
                </span>
                <span className="text-muted-foreground ml-1.5 text-xs">
                    {description}
                </span>
            </div>
            <span className="font-mono text-sm font-medium tabular-nums">
                {formatted}
            </span>
        </div>
    );
}

/**
 * RSC section: TTM valuation multiples — PER, PSR, PBR, PEG, EV/EBITDA, EPS.
 *
 * Data is fetched by the parent RSC page and passed as a typed prop.
 */
export function ValuationCard({ metrics }: ValuationCardProps) {
    return (
        <section
            aria-labelledby="valuation-heading"
            className="border-border bg-card rounded-xl border p-6"
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
                />
                <MetricRow
                    label="PSR"
                    value={metrics.priceToSalesRatioTTM}
                    description="주가매출비율 (TTM)"
                />
                <MetricRow
                    label="PBR"
                    value={metrics.pbRatioTTM}
                    description="주가순자산비율 (TTM)"
                />
                <MetricRow
                    label="PEG"
                    value={metrics.pegRatioTTM}
                    description="성장가치비율 (TTM)"
                />
                <MetricRow
                    label="EV/EBITDA"
                    value={metrics.enterpriseValueOverEBITDATTM}
                    description="기업가치/EBITDA (TTM)"
                    digits={1}
                />
                <MetricRow
                    label="EPS"
                    value={metrics.epsTTM}
                    description="주당순이익 (TTM)"
                />
            </div>
        </section>
    );
}
