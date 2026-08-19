import { useTranslations } from 'next-intl';
import { MarkdownText } from '@/shared/ui/MarkdownText';

interface TechnicalSummaryProps {
    bullets: string[];
}

/** RSC section: technical analysis bullet points from the overall analysis result. */
export function TechnicalSummary({ bullets }: TechnicalSummaryProps) {
    const t = useTranslations('widgets.overall');
    if (bullets.length === 0) return null;
    return (
        <section
            aria-labelledby="technical-summary-heading"
            className="rounded-xl border border-secondary-700 bg-secondary-800 p-6"
        >
            <h2
                id="technical-summary-heading"
                className="mb-3 text-lg font-semibold text-balance"
            >
                {t('TechnicalSummary.938737')}
            </h2>
            <ul aria-label={t('TechnicalSummary.6d957a')} className="space-y-2">
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
