import { MarkdownText } from '@/shared/ui/MarkdownText';

interface OverallSummaryProps {
    headline: string;
}

export function OverallSummary({ headline }: OverallSummaryProps) {
    if (!headline) return null;
    return (
        <section
            aria-labelledby="overall-summary-heading"
            className="border-secondary-700 bg-secondary-800 rounded-xl border p-6"
        >
            <h2
                id="overall-summary-heading"
                className="mb-3 text-lg font-semibold text-balance"
            >
                종합 요약
            </h2>
            <MarkdownText className="text-secondary-400 text-sm">
                {headline}
            </MarkdownText>
        </section>
    );
}
