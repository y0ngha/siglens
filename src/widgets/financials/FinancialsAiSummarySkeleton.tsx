import { type CSSProperties } from 'react';

const SKELETON_LINE_COUNT = 3;
const SKELETON_WIDTH_START_PCT = 85;
const SKELETON_WIDTH_STEP_PCT = 12;

export function FinancialsAiSummarySkeleton() {
    return (
        <section
            aria-labelledby="financials-ai-summary-loading-heading"
            aria-busy="true"
            className="border-secondary-700 bg-secondary-800 rounded-xl border p-6"
        >
            <h2
                id="financials-ai-summary-loading-heading"
                className="mb-4 text-lg font-semibold tracking-tight"
            >
                AI 재무제표 분석
            </h2>
            <div className="flex items-center gap-3">
                <div
                    aria-hidden="true"
                    className="border-primary-500 h-4 w-4 animate-spin rounded-full border-2 border-t-transparent motion-reduce:animate-none"
                />
                <p
                    className="text-secondary-400 text-sm"
                    aria-live="polite"
                    aria-atomic="true"
                >
                    AI 재무제표 분석 진행 중…
                </p>
            </div>
            <div className="mt-4 space-y-2">
                {[...Array(SKELETON_LINE_COUNT)].map((_, i) => (
                    <div
                        key={`skeleton-line-${i}`}
                        className="bg-secondary-700 h-4 w-(--skeleton-w) animate-pulse rounded motion-reduce:animate-none"
                        style={
                            {
                                '--skeleton-w': `${SKELETON_WIDTH_START_PCT - i * SKELETON_WIDTH_STEP_PCT}%`,
                            } as CSSProperties
                        }
                        aria-hidden="true"
                    />
                ))}
            </div>
        </section>
    );
}
