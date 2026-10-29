/** The `/about` "more on SIGLENS" link nav. */
import { LocaleLink } from '@/shared/ui/LocaleLink';
import type { LabelledLink } from '../../lib/types';

const HEADING_ID = 'about-more';

const MORE_LINK =
    'inline-flex min-h-10 items-center rounded text-sm text-secondary-400 underline-offset-2 hover:text-primary-400 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

interface MoreLinksNavProps {
    readonly title: string;
    /** Site paths, locale-prefixed by `LocaleLink`. */
    readonly links: readonly LabelledLink[];
    /** The cross-host SIGLENS AI link, already absolute and locale-prefixed. */
    readonly aiLink: LabelledLink;
}

/** A `<nav>` named by its h2: the hub links, then the SIGLENS AI about page. */
export function MoreLinksNav({ title, links, aiLink }: MoreLinksNavProps) {
    return (
        <nav aria-labelledby={HEADING_ID} className="mt-12">
            <h2
                id={HEADING_ID}
                className="text-sm font-semibold text-secondary-300"
            >
                {title}
            </h2>
            <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
                {links.map(({ href, label }) => (
                    <li key={href}>
                        <LocaleLink href={href} className={MORE_LINK}>
                            {label}
                        </LocaleLink>
                    </li>
                ))}
                <li>
                    <a href={aiLink.href} className={MORE_LINK}>
                        {aiLink.label}
                    </a>
                </li>
            </ul>
        </nav>
    );
}
