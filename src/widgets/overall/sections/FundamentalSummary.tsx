import { MarkdownText } from '@/shared/ui/MarkdownText';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';

interface FundamentalSummaryProps {
    bullets: string[];
}

export function FundamentalSummary({ bullets }: FundamentalSummaryProps) {
    if (bullets.length === 0) return null;
    return (
        <section
            aria-labelledby="fundamental-summary-heading"
            className="rounded-lg border border-secondary-700 bg-secondary-800 p-6"
        >
            <h2
                id="fundamental-summary-heading"
                className={cn(HEADING_SECTION, 'mb-3 text-balance')}
            >
                펀더멘털 분석 요약
            </h2>
            <ul aria-label="펀더멘털 분석 항목" className="space-y-2">
                {bullets.map(bullet => (
                    <li key={bullet} className="flex gap-2 text-sm">
                        <span
                            aria-hidden="true"
                            className="mt-0.5 shrink-0 text-secondary-400"
                        >
                            •
                        </span>
                        <MarkdownText className="min-w-0 text-secondary-400">
                            {bullet}
                        </MarkdownText>
                    </li>
                ))}
            </ul>
        </section>
    );
}
