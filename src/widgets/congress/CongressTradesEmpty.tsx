import { useTranslations } from 'next-intl';
/**
 * Empty-state card for the `CongressTradesTable` when there are no trades.
 *
 * This is the table widget's own empty path — distinct from the AI summary's
 * `no_trades` branch (`CongressTrendSummaryEmpty`). It communicates that the
 * SSR trade rows simply came back empty, without implying an error.
 */
export function CongressTradesEmpty() {
    const t = useTranslations('widgets.congress');
    return (
        <div
            role="status"
            aria-label={t('CongressTradesEmpty.be4210')}
            className="rounded-lg border border-secondary-700 bg-secondary-800 px-5 py-4"
        >
            <p className="text-sm text-secondary-400">
                {t('CongressTradesEmpty.cb8eae')}
            </p>
        </div>
    );
}
