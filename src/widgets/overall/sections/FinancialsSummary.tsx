import { MarkdownText } from '@/shared/ui/MarkdownText';

interface FinancialsSummaryProps {
    bullets: string[];
}

export function FinancialsSummary({ bullets }: FinancialsSummaryProps) {
    if (bullets.length === 0) return null;
    return (
        <section
            aria-labelledby="financials-summary-heading"
            className="border-secondary-700 bg-secondary-800 rounded-xl border p-6"
        >
            <h2
                id="financials-summary-heading"
                className="mb-3 text-lg font-semibold text-balance"
            >
                재무 분석
            </h2>
            <ul aria-label="재무 분석 항목" className="space-y-2">
                {bullets.map((bullet, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                        <span
                            aria-hidden="true"
                            className="text-secondary-400 mt-0.5 shrink-0"
                        >
                            •
                        </span>
                        <MarkdownText className="text-secondary-400 min-w-0">
                            {bullet}
                        </MarkdownText>
                    </li>
                ))}
            </ul>
        </section>
    );
}
