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
            className="overflow-x-auto overflow-y-hidden border-b border-secondary-700"
        >
            {/* 실제 `SymbolTabs`와 **같은 래퍼**를 둔다. 여기만 전폭이면 탭이
                들어오는 순간 가로로 튄다 — 실측 1280px 140px, 1920px 460px.
                `min-h-11`도 실제 탭 링크와 같은 값이다. 알약만 두면 40px이라
                탭이 들어올 때 세로로도 밀린다. */}
            <div className="symbol-container -mb-px flex min-h-11 min-w-max items-center px-0">
                {Array.from({ length: SKELETON_PILL_COUNT }, (_, i) => (
                    <span
                        key={i}
                        className="mx-1 my-2 h-6 w-16 animate-pulse rounded bg-secondary-700/40"
                        aria-hidden="true"
                    />
                ))}
            </div>
        </nav>
    );
}
