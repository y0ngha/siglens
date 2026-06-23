/**
 * Static SymbolTabs fallback — no usePathname so the PPR prerender shell can resolve.
 *
 * Renders label-less placeholder pills instead of equity-specific tab labels so
 * no equity copy flashes on crypto routes before the real SymbolTabs hydrates.
 * The pill count (4) is a neutral minimum that covers any profile's tab set without
 * profile resolution in this static skeleton.
 */
const SKELETON_PILL_COUNT = 4;

export function SymbolTabsSkeleton() {
    return (
        <nav
            aria-hidden="true"
            className="border-secondary-700 flex overflow-x-auto border-b"
        >
            {Array.from({ length: SKELETON_PILL_COUNT }, (_, i) => (
                <span
                    key={i}
                    className="bg-secondary-700/40 mx-1 my-2 h-6 w-16 animate-pulse rounded"
                    aria-hidden="true"
                />
            ))}
        </nav>
    );
}
