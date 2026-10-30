/** The `/about` method section's "how fresh is the data" box. */
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import { LocaleLink } from '@/shared/ui/LocaleLink';
import type { LabelledLink } from '../../lib/types';
import { TEXT_LINK } from '../aboutStyles';

interface FreshnessCardProps {
    readonly title: string;
    readonly lines: readonly string[];
    /** Site links under the list (methodology, backtesting). */
    readonly links: readonly LabelledLink[];
}

/** An h3, the freshness bullets and the links to the deeper pages. */
export function FreshnessCard({ title, lines, links }: FreshnessCardProps) {
    return (
        <div className={cn(SURFACE_CARD, 'mt-4 px-4 py-4 sm:px-5')}>
            <h3 className={HEADING_SUBSECTION}>{title}</h3>
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm leading-6 text-secondary-300 marker:text-secondary-500">
                {lines.map(line => (
                    <li key={line}>{line}</li>
                ))}
            </ul>
            <div className="mt-3 flex flex-wrap items-center gap-x-5">
                {links.map(({ href, label }) => (
                    <LocaleLink
                        key={href}
                        href={href}
                        className={cn(
                            TEXT_LINK,
                            'inline-flex min-h-11 items-center text-sm'
                        )}
                    >
                        {label}
                    </LocaleLink>
                ))}
            </div>
        </div>
    );
}
