import type { MoreLink } from '../../lib/aboutSections';

interface Props {
    readonly title: string;
    readonly links: readonly MoreLink[];
}

/**
 * The "more on SIGLENS" link list: a navigation landmark named by its heading.
 * Not an `AboutSection` on purpose: it is a `<nav>`, not a content region, and
 * its h2 is a small label, not a section title.
 */
export function AboutMoreNav({ title, links }: Props) {
    return (
        <nav aria-labelledby="about-more" className="mt-12">
            <h2
                id="about-more"
                className="text-sm font-semibold text-secondary-300"
            >
                {title}
            </h2>
            <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
                {links.map(({ href, label }) => (
                    <li key={href}>
                        <a
                            href={href}
                            className="inline-flex min-h-10 items-center rounded text-sm text-secondary-400 underline-offset-2 hover:text-primary-400 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                        >
                            {label}
                        </a>
                    </li>
                ))}
            </ul>
        </nav>
    );
}
