import { type CSSProperties } from 'react';

const SKELETON_LINE_COUNT = 3;

export function NewsAiSummarySkeleton() {
    return (
        <section
            aria-labelledby="news-ai-summary-loading-heading"
            aria-busy="true"
            className="border-secondary-700 bg-secondary-800 rounded-xl border p-6"
        >
            <h2
                id="news-ai-summary-loading-heading"
                className="mb-4 text-lg font-semibold tracking-tight"
            >
                AI 뉴스 종합 분석
            </h2>
            <div className="flex items-center gap-3">
                <div
                    aria-hidden="true"
                    className="border-primary-500 h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"
                />
                <p
                    className="text-secondary-400 text-sm"
                    aria-live="polite"
                    aria-atomic="true"
                >
                    AI 뉴스 분석 진행 중…
                </p>
            </div>
            <div className="mt-4 space-y-2">
                {[...Array(SKELETON_LINE_COUNT)].map((_, i) => (
                    <div
                        key={i}
                        className="bg-secondary-700 h-4 w-[var(--skeleton-w)] animate-pulse rounded"
                        style={
                            {
                                '--skeleton-w': `${85 - i * 12}%`,
                            } as CSSProperties
                        }
                        aria-hidden="true"
                    />
                ))}
            </div>
        </section>
    );
}
