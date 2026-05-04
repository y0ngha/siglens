import { TABS } from '@/components/symbol-page/SymbolTabsConfig';

// Static SymbolTabs fallback — no usePathname so the PPR prerender shell can resolve.
export function SymbolTabsSkeleton() {
    return (
        <nav
            aria-hidden="true"
            className="border-secondary-700 flex overflow-x-auto border-b"
        >
            {TABS.map(tab => (
                <span
                    key={tab.key}
                    className="text-secondary-400 px-4 py-2 text-sm whitespace-nowrap"
                >
                    {tab.label}
                </span>
            ))}
        </nav>
    );
}
