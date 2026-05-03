const TAB_LABELS = ['차트', '뉴스', '펀더', '종합'] as const;

/**
 * Static fallback for SymbolTabs — renders tab-shaped placeholders without
 * active-state detection so there is no dynamic data access (usePathname).
 *
 * Used as the Suspense fallback inside SymbolPageHeader so the static PPR
 * prerender shell can complete without accessing request-time data.
 */
export function SymbolTabsSkeleton() {
    return (
        <nav
            aria-label="분석 종류"
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
