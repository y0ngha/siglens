import { useTranslations } from 'next-intl';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import type { SectorSignalsResult } from '@y0ngha/siglens-core';
import { buildSectorFacts } from '@/entities/sector-signal';

interface SectorFactsSummaryProps {
    data: SectorSignalsResult;
}

/**
 * Server component that renders sector signal counts as crawlable SSR text.
 *
 * `SectorSignalPanel` uses `useSearchParams` which causes a CSR bailout, leaving
 * the SSR HTML empty for crawlers. This component fills that gap by rendering the
 * same underlying signal data as a static text summary in the Suspense fallback.
 *
 * When JS hydrates, `SectorSignalPanel` takes over with the interactive UI.
 * Both render the same factual data → no cloaking.
 *
 * On a no-signal snapshot (`facts` empty) it renders a minimal sentence instead
 * of `null`, so the prerendered HTML is never text-empty for crawlers (the
 * SSR crawl-text guarantee shouldn't be data-dependent).
 *
 * `topSymbols` render as real `<Link href="/{symbol}">` anchors (not plain text)
 * so this server-rendered hub page passes crawlable internal links into the
 * per-symbol pages — the interactive `SectorSignalPanel` (CSR) is invisible to
 * crawlers, so without these this page would ship zero server-side `/{symbol}` links.
 */
export function SectorFactsSummary({ data }: SectorFactsSummaryProps) {
    const t = useTranslations('widgets.dashboard');
    const facts = buildSectorFacts(data);

    return (
        <section
            aria-label={t('SectorFactsSummary.a39a24')}
            className="sector-panel-bg px-6 py-10 lg:px-[15vw]"
        >
            <h2 className="mb-6 text-sm font-semibold tracking-[0.15em] text-secondary-200 uppercase">
                {t('SectorFactsSummary.581217')}
            </h2>
            {facts.length === 0 ? (
                <p className="text-sm text-secondary-300">
                    {t('SectorFactsSummary.9550ad')}
                </p>
            ) : (
                <dl className="flex flex-col gap-4 text-sm text-secondary-300">
                    {facts.map(fact => (
                        <div key={fact.sectorSymbol}>
                            <dt className="mb-1 font-medium text-secondary-400">
                                {fact.sectorSymbol}
                            </dt>
                            <dd>
                                {t('SectorFactsSummary.080a8a')}{' '}
                                {fact.bullishCount}
                                {t('SectorFactsSummary.7e56b6')}{' '}
                                {fact.bearishCount}
                                {t('SectorFactsSummary.dfa8d7')}
                                {fact.topSymbols.length > 0 && (
                                    <span className="ml-2 text-secondary-500">
                                        {/* parens as JSX expressions → no stray whitespace around them */}
                                        {'('}
                                        {fact.topSymbols.map((symbol, i) => (
                                            <span key={symbol}>
                                                {i > 0 && ', '}
                                                <Link
                                                    href={`/${symbol}`}
                                                    className="rounded-sm underline-offset-2 hover:text-secondary-300 hover:underline focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-950 focus-visible:outline-none"
                                                >
                                                    {symbol}
                                                </Link>
                                            </span>
                                        ))}
                                        {')'}
                                    </span>
                                )}
                            </dd>
                        </div>
                    ))}
                </dl>
            )}
        </section>
    );
}
