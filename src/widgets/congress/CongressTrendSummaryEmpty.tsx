import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { cn } from '@/shared/lib/cn';
import { useTranslations } from 'next-intl';
/**
 * Empty-state renderer for the `no_trades` branch unique to congress.
 *
 * Congress 0건 = 정상(NOT an error): many symbols simply have no public-disclosure
 * filings, so the submit pipeline deliberately skips LLM dispatch. This component
 * mirrors the success card's shell + heading so the page layout stays stable and
 * communicates the policy choice without sounding like a failure.
 */
export function CongressTrendSummaryEmpty() {
    const t = useTranslations('widgets.congress');
    return (
        <section
            aria-labelledby="congress-trend-summary-empty-heading"
            className="rounded-lg border border-secondary-700 bg-secondary-800 p-6"
        >
            <h2
                id="congress-trend-summary-empty-heading"
                className={cn('mb-3', HEADING_SECTION)}
            >
                {t('CongressTrendSummaryEmpty.bbb041')}
            </h2>
            <p className="text-sm leading-relaxed text-secondary-400">
                {t('CongressTrendSummaryEmpty.34ec4b')}
            </p>
        </section>
    );
}
