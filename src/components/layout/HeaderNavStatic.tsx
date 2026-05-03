import Link from 'next/link';

interface NavItem {
    readonly href: string;
    readonly label: string;
}

interface HeaderNavStaticProps {
    readonly items: ReadonlyArray<NavItem>;
}

// Static HeaderNav fallback — usePathname 없이 PPR prerender shell이 정적으로 완료되도록 Suspense fallback 역할.
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
