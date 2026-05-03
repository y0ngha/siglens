const TAB_LABELS = ['차트', '뉴스', '펀더', '종합'] as const;

// Static SymbolTabs fallback — no usePathname so the PPR prerender shell can resolve.
export function SymbolTabsSkeleton() {
    return (
        <nav
            aria-hidden="true"
            className="border-secondary-700 flex overflow-x-auto border-b"
        >
            {TAB_LABELS.map(label => (
                <span
                    key={label}
                    className="text-secondary-400 px-4 py-2 text-sm whitespace-nowrap"
                >
                    {label}
                </span>
            ))}
        </nav>
    );
}
