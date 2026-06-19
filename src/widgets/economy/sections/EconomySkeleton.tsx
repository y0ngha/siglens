/**
 * Streaming / cold-gen Suspense fallback for EconomyContent.
 *
 * Mirrors the rough visual structure of EconomyContent:
 *   1. Macro-facts section — an SSR text proxy visible to crawlers in the real
 *      component. We need a height placeholder so the layout doesn't shift on
 *      hydration when EconomyContent resolves.
 *   2. MacroBriefing card — matches MacroBriefingSkeleton dimensions.
 *   3. Indicator grid — a 2-column grid of pulse cards, one per category
 *      placeholder (金利·物価·成長·雇用 ≈ 4 groups, 3 cards each row).
 *   4. Economic calendar placeholder.
 *
 * All pulse blocks use the project's standard:
 *   `border-secondary-700 bg-secondary-800 rounded-xl border p-6 animate-pulse
 *    motion-reduce:animate-none`
 *
 * Pure presentational — no 'use client', no data dependencies.
 */
export function EconomySkeleton() {
    return (
        <div
            className="space-y-6"
            role="status"
            aria-label="경제 지표 로딩 중"
            aria-busy="true"
        >
            <section
                className="border-secondary-700 bg-secondary-800 animate-pulse rounded-xl border p-6 motion-reduce:animate-none"
                aria-hidden="true"
            >
                <div className="bg-secondary-700 mb-3 h-6 w-36 rounded" />
                <div className="bg-secondary-700 h-4 w-full rounded" />
            </section>

            <section
                className="border-secondary-700 bg-secondary-800 animate-pulse rounded-xl border p-6 motion-reduce:animate-none"
                aria-hidden="true"
            >
                <div className="mb-4 flex items-center gap-3">
                    <div className="bg-secondary-700 h-6 w-28 rounded" />
                    <div className="bg-secondary-700 h-5 w-14 rounded" />
                </div>
                <div className="bg-secondary-700 mb-2 h-4 w-full rounded" />
                <div className="bg-secondary-700 mb-2 h-4 w-5/6 rounded" />
                <div className="bg-secondary-700 h-4 w-4/5 rounded" />
            </section>

            <div
                className="grid grid-cols-1 gap-4 sm:grid-cols-2"
                aria-hidden="true"
            >
                {Array.from({ length: 4 }).map((_, i) => (
                    <section
                        key={i}
                        className="border-secondary-700 bg-secondary-800 animate-pulse rounded-xl border p-6 motion-reduce:animate-none"
                    >
                        <div className="bg-secondary-700 mb-4 h-5 w-20 rounded" />
                        <div className="space-y-3">
                            {Array.from({ length: 3 }).map((_, j) => (
                                <div
                                    key={j}
                                    className="bg-secondary-700/60 flex items-center justify-between rounded p-3"
                                >
                                    <div className="bg-secondary-700 h-4 w-24 rounded" />
                                    <div className="bg-secondary-700 h-4 w-16 rounded" />
                                </div>
                            ))}
                        </div>
                    </section>
                ))}
            </div>

            <section
                className="border-secondary-700 bg-secondary-800 animate-pulse rounded-xl border p-6 motion-reduce:animate-none"
                aria-hidden="true"
            >
                <div className="bg-secondary-700 mb-4 h-5 w-32 rounded" />
                <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div
                            key={i}
                            className="bg-secondary-700/60 flex items-center gap-4 rounded p-3"
                        >
                            <div className="bg-secondary-700 h-4 w-20 rounded" />
                            <div className="bg-secondary-700 h-4 w-40 rounded" />
                            <div className="bg-secondary-700 ml-auto h-4 w-12 rounded" />
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
