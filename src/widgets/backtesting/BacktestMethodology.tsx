import { useTranslations } from 'next-intl';

/**
 * Always-visible methodology card, directly below `BacktestHero`.
 *
 * Not collapsible on purpose — the numbers above this card (win rate,
 * decisive-case AI rate, mean return) are meaningless without the rules that
 * produced them (win definition, exit rule, no transaction costs, a fixed
 * post-hoc universe). Hiding that behind a toggle would recreate the same
 * "numbers without context" problem this widget exists to fix.
 *
 * Reuses the hero's card tone (`border-secondary-700`/`bg-secondary-800`) —
 * no new visual language for this page.
 */
export function BacktestMethodology() {
    const t = useTranslations('widgets.backtesting.methodology');
    const items = [
        t('winDefinition'),
        t('exitRule'),
        t('noCosts'),
        t('universe'),
        t('dataSource'),
    ];

    return (
        <section
            aria-labelledby="backtest-methodology-heading"
            className="page-container py-6"
        >
            <div className="rounded-lg border border-secondary-700 bg-secondary-800 px-6 py-5">
                <h2
                    id="backtest-methodology-heading"
                    className="mb-3 text-sm font-semibold text-secondary-200"
                >
                    {t('heading')}
                </h2>
                <ul className="space-y-1.5 text-sm leading-relaxed text-secondary-400">
                    {items.map(item => (
                        <li key={item}>{item}</li>
                    ))}
                </ul>
            </div>
        </section>
    );
}
