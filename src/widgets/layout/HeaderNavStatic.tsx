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
                    // HeaderNav와 동일 — 전역 네비 prefetch는 `_rsc` 해시 파편화로
                    // 캐시 미스만 늘린다 (docs/architecture/CDN_CACHING.md §1).
                    prefetch={false}
                    className="-mb-px flex min-h-11 touch-manipulation items-center border-b-2 border-transparent px-2 text-xs font-semibold tracking-[0.12em] text-secondary-400 uppercase transition-colors hover:text-secondary-100 focus-visible:rounded focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                >
                    {item.label}
                </Link>
            ))}
        </nav>
    );
}
