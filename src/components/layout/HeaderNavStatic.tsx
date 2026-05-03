import Link from 'next/link';

interface NavItem {
    readonly href: string;
    readonly label: string;
}

interface HeaderNavStaticProps {
    readonly items: ReadonlyArray<NavItem>;
}

/**
 * Static fallback for HeaderNav — renders nav links without active-state
 * detection so there is no dynamic data access (usePathname).
 *
 * Used as the Suspense fallback inside Header so the static PPR prerender
 * shell can complete without accessing request-time data.
 */
export function HeaderNavStatic({ items }: HeaderNavStaticProps) {
    return (
        <nav aria-label="주요 네비게이션" className="flex gap-1 sm:gap-4">
            {items.map(item => (
                <Link
                    key={item.href}
                    href={item.href}
                    className="focus-visible:ring-primary-500 text-secondary-400 hover:text-secondary-100 -mb-px flex min-h-11 touch-manipulation items-center border-b-2 border-transparent px-2 text-xs font-semibold tracking-[0.12em] uppercase transition-colors focus-visible:rounded focus-visible:ring-2 focus-visible:outline-none"
                >
                    {item.label}
                </Link>
            ))}
        </nav>
    );
}
