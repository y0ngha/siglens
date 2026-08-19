import { useTranslations } from 'next-intl';
import { MarkdownText } from '@/shared/ui/MarkdownText';

interface OverallSummaryProps {
    headline: string;
}

export function OverallSummary({ headline }: OverallSummaryProps) {
    const t = useTranslations('widgets.overall');
    if (!headline) return null;
    return (
        <section
            aria-labelledby="overall-summary-heading"
            className="rounded-xl border border-secondary-700 bg-secondary-800 p-6"
        >
            <h2
                id="overall-summary-heading"
                className="mb-3 text-lg font-semibold text-balance"
            >
                {t('OverallSummary.99a89d')}
            </h2>
            <MarkdownText className="text-sm text-secondary-400">
                {headline}
            </MarkdownText>
        </section>
    );
}
