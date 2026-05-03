interface FundamentalSummaryProps {
    bullets: string[];
}

/**
 * Renders fundamental analysis bullet points from the overall analysis result.
 */
export function FundamentalSummary({ bullets }: FundamentalSummaryProps) {
    if (bullets.length === 0) return null;
    return (
        <section
            aria-labelledby="fundamental-summary-heading"
            className="rounded-xl border border-border bg-card p-6"
        >
            <h2
                id="fundamental-summary-heading"
                className="mb-3 text-lg font-semibold text-balance"
            >
                펀더멘털 분석 요약
            </h2>
            <ul aria-label="펀더멘털 분석 항목" className="space-y-2">
                {bullets.map((bullet, i) => (
                    <li
                        key={i}
                        className="text-muted-foreground flex gap-2 text-sm"
                    >
                        <span aria-hidden="true" className="mt-0.5 shrink-0">
                            •
                        </span>
                        {bullet}
                    </li>
                ))}
            </ul>
        </section>
    );
}
