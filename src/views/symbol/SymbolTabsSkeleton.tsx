/** Neutral minimum pill count — covers any profile's tab set without profile resolution. */
export const SKELETON_PILL_COUNT = 4;

/**
 * Static SymbolTabs fallback — no usePathname so the PPR prerender shell can resolve.
 *
 * Renders label-less placeholder pills instead of equity-specific tab labels so
 * no equity copy flashes on crypto routes before the real SymbolTabs hydrates.
 */
export function SymbolTabsSkeleton() {
    return (
        <nav
            aria-hidden="true"
            // 실제 SymbolTabs와 동일하게 overflow-y-hidden으로 세로 스크롤 승격을 막는다
            // (overflow-x-auto 단독은 overflow-y를 auto로 승격시켜 세로 스크롤바를 유발).
            className="border-secondary-700 flex overflow-x-auto overflow-y-hidden border-b"
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
