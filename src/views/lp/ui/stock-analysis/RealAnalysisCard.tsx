/**
 * One real, cached analysis excerpt on `/lp/stock-analysis`.
 */
import { useId } from 'react';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import { REAL_ANALYSIS_COPY } from '../../lib/stockAnalysisContent';
import type { LpRealAnalysis } from '../../lib/types';

const TEXT_LINK =
    'rounded text-secondary-300 underline underline-offset-2 hover:text-primary-400 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

interface RealAnalysisCardProps {
    readonly analysis: LpRealAnalysis;
}

/**
 * Name and symbol, the data date, the trend (text only, no colour: DS-15), the
 * excerpt paragraphs and a link to the full analysis. Renders the `<li>`
 * itself, so it goes straight into a `<ul>`. Server component: the whole
 * excerpt is in the HTML.
 */
export function RealAnalysisCard({ analysis }: RealAnalysisCardProps) {
    const headingId = useId();
    const { name, symbol, asOfIso, asOfLabel, trendLabel, paragraphs, href } =
        analysis;
    return (
        <li className="flex">
            <article
                aria-labelledby={headingId}
                className={cn(
                    SURFACE_CARD,
                    'flex h-full w-full flex-col gap-3 p-4 sm:p-5'
                )}
            >
                <h3 id={headingId} className={HEADING_SUBSECTION}>
                    {name}{' '}
                    <span
                        className="font-mono text-xs text-secondary-400"
                        translate="no"
                    >
                        {symbol}
                    </span>
                </h3>
                <p className="text-xs text-secondary-400">
                    <time dateTime={asOfIso}>{asOfLabel}</time>
                </p>
                {trendLabel !== null && (
                    <p className="text-sm font-medium text-secondary-200">
                        {REAL_ANALYSIS_COPY.trendPrefix}: {trendLabel}
                    </p>
                )}
                <div className="flex flex-col gap-3">
                    {paragraphs.map(paragraph => (
                        <p
                            key={paragraph}
                            className="text-sm leading-7 text-secondary-200"
                        >
                            {paragraph}
                        </p>
                    ))}
                </div>
                <a
                    href={href}
                    className={cn(
                        TEXT_LINK,
                        'mt-auto inline-flex min-h-11 w-fit items-center text-sm'
                    )}
                >
                    {REAL_ANALYSIS_COPY.more(name)}
                </a>
            </article>
        </li>
    );
}
