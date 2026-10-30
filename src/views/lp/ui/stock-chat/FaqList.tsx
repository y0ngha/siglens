/**
 * `/lp/stock-chat`'s FAQ as native disclosure widgets.
 */
import type { FaqEntry } from '../../lib/types';

interface FaqListProps {
    readonly items: readonly FaqEntry[];
}

/** One `<details>` per entry; the `+` turns into `×` when open. */
export function FaqList({ items }: FaqListProps) {
    return (
        <div className="mt-6 divide-y divide-secondary-700 border-y border-secondary-700">
            {items.map(({ q, a }) => (
                <details key={q} className="group">
                    <summary className="flex min-h-13 cursor-pointer list-none items-center justify-between gap-3 rounded text-[15px] font-medium text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                        {q}
                        <span
                            aria-hidden="true"
                            className="text-lg text-secondary-400 transition-transform group-open:rotate-45 motion-reduce:transition-none"
                        >
                            +
                        </span>
                    </summary>
                    <p className="max-w-2xl pb-4 text-sm leading-6 text-secondary-300">
                        {a}
                    </p>
                </details>
            ))}
        </div>
    );
}
