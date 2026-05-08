import { MarkdownText } from '@/components/ui/MarkdownText';

interface TechnicalSummaryProps {
    bullets: string[];
}

/** RSC section: technical analysis bullet points from the overall analysis result. */
export function TechnicalSummary({ bullets }: TechnicalSummaryProps) {
    if (bullets.length === 0) return null;
    return (
        <section
            aria-labelledby="technical-summary-heading"
            className="border-secondary-700 bg-secondary-800 rounded-xl border p-6"
        >
            <h2
                id="technical-summary-heading"
                className="mb-3 text-lg font-semibold text-balance"
            >
                기술적 분석 요약
            </h2>
            <ul aria-label="기술적 분석 항목" className="space-y-2">
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
