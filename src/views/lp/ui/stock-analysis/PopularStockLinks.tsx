/**
 * The "많이 찾는 종목" chip list on `/lp/stock-analysis`.
 */
import { SITE_URL } from '@/shared/lib/seo';
import type { PopularStock } from '../../lib/types';

interface PopularStockLinksProps {
    readonly stocks: readonly PopularStock[];
}

/**
 * One outline link per stock into its symbol page, company name first. The
 * space between name and ticker keeps the link's accessible name "엔비디아
 * NVDA" rather than "엔비디아NVDA"; the flex gap only separates them visually.
 */
export function PopularStockLinks({ stocks }: PopularStockLinksProps) {
    return (
        <ul className="mt-7 flex flex-wrap gap-3">
            {stocks.map(({ name, symbol }) => (
                <li key={symbol}>
                    <a
                        href={`${SITE_URL}/${symbol}`}
                        // Outline control: its border must pass 3:1, so
                        // `border-control`, not the card's decorative border.
                        className="flex min-h-11 items-center gap-2 rounded-lg border border-border-control bg-secondary-800 px-4 text-sm transition-colors hover:border-primary-500 hover:bg-secondary-700/40 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none active:bg-secondary-700/60 motion-reduce:transition-none"
                    >
                        <span className="font-semibold text-secondary-100">
                            {name}
                        </span>{' '}
                        <span
                            className="font-mono text-xs text-secondary-400"
                            translate="no"
                        >
                            {symbol}
                        </span>
                    </a>
                </li>
            ))}
        </ul>
    );
}
