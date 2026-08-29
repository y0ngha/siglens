import { useTranslations } from 'next-intl';
import { MarkdownText } from '@/shared/ui/MarkdownText';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';

interface FinancialsSummaryProps {
    bullets: string[];
}

export function FinancialsSummary({ bullets }: FinancialsSummaryProps) {
    const t = useTranslations('widgets.overall');
    if (bullets.length === 0) return null;
    return (
        <section
            aria-labelledby="financials-summary-heading"
            className="rounded-lg border border-secondary-700 bg-secondary-800 p-6"
        >
            <h2
                id="financials-summary-heading"
                className={cn(HEADING_SECTION, 'mb-3 text-balance')}
            >
                {t('FinancialsSummary.9f2f34')}
            </h2>
            <ul
                aria-label={t('FinancialsSummary.ecbc52')}
                className="space-y-2"
            >
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
