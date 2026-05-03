interface RiskFactorsProps {
    factors: string[];
}

/**
 * Renders the risk factor bullet points from the overall analysis result.
 */
export function RiskFactors({ factors }: RiskFactorsProps) {
    if (factors.length === 0) return null;
    return (
        <section
            aria-labelledby="risk-factors-heading"
            className="rounded-xl border border-border bg-card p-6"
        >
            <h2
                id="risk-factors-heading"
                className="mb-3 text-lg font-semibold text-balance"
            >
                위험 요인
            </h2>
            <ul aria-label="위험 요인 목록" className="space-y-2">
                {factors.map((factor, i) => (
                    <li
                        key={i}
                        className="text-muted-foreground flex gap-2 text-sm"
                    >
                        <span aria-hidden="true" className="mt-0.5 shrink-0">
                            •
                        </span>
                        {factor}
                    </li>
                ))}
            </ul>
        </section>
    );
}
