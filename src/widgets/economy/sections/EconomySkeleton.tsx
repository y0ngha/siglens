/**
 * Streaming / cold-gen Suspense fallback for EconomyContent.
 *
 * Mirrors the rough visual structure of EconomyContent:
 *   1. Macro-facts section — an SSR text proxy visible to crawlers in the real
 *      component. We need a height placeholder so the layout doesn't shift on
 *      hydration when EconomyContent resolves.
 *   2. MacroBriefing card — matches MacroBriefingSkeleton dimensions.
 *   3. Indicator grid — a 2-column grid of pulse cards, one per category group
 *      (금리·물가·성장·고용 ≈ 4 groups, ~3 indicator rows per card).
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
                className="animate-pulse rounded-xl border border-secondary-700 bg-secondary-800 p-6 motion-reduce:animate-none"
                aria-hidden="true"
            >
                <div className="mb-3 h-6 w-36 rounded bg-secondary-700" />
                <div className="h-4 w-full rounded bg-secondary-700" />
            </section>

            <section
                className="animate-pulse rounded-xl border border-secondary-700 bg-secondary-800 p-6 motion-reduce:animate-none"
                aria-hidden="true"
            >
                <div className="mb-4 flex items-center gap-3">
                    <div className="h-6 w-28 rounded bg-secondary-700" />
                    <div className="h-5 w-14 rounded bg-secondary-700" />
                </div>
                <div className="mb-2 h-4 w-full rounded bg-secondary-700" />
                <div className="mb-2 h-4 w-5/6 rounded bg-secondary-700" />
                <div className="h-4 w-4/5 rounded bg-secondary-700" />
            </section>

            <div
                className="grid grid-cols-1 gap-4 sm:grid-cols-2"
                aria-hidden="true"
            >
                {Array.from({ length: 4 }).map((_, i) => (
                    <section
                        key={i}
                        className="animate-pulse rounded-xl border border-secondary-700 bg-secondary-800 p-6 motion-reduce:animate-none"
                    >
                        <div className="mb-4 h-5 w-20 rounded bg-secondary-700" />
                        <div className="space-y-3">
                            {Array.from({ length: 3 }).map((_, j) => (
                                <div
                                    key={j}
                                    className="flex items-center justify-between rounded bg-secondary-700/60 p-3"
                                >
                                    <div className="h-4 w-24 rounded bg-secondary-700" />
                                    <div className="h-4 w-16 rounded bg-secondary-700" />
                                </div>
                            ))}
                        </div>
                    </section>
                ))}
            </div>

            <section
                className="animate-pulse rounded-xl border border-secondary-700 bg-secondary-800 p-6 motion-reduce:animate-none"
                aria-hidden="true"
            >
                <div className="mb-4 h-5 w-32 rounded bg-secondary-700" />
                <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div
                            key={i}
                            className="flex items-center gap-4 rounded bg-secondary-700/60 p-3"
                        >
                            <div className="h-4 w-20 rounded bg-secondary-700" />
                            <div className="h-4 w-40 rounded bg-secondary-700" />
                            <div className="ml-auto h-4 w-12 rounded bg-secondary-700" />
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
