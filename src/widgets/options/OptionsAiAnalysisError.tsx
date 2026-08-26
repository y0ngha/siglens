'use client';

import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';

interface OptionsAiAnalysisErrorProps {
    resetErrorBoundary?: () => void;
}

/**
 * Fallback shown when the AI options analysis fails. The on-page metrics row
 * and OI chart remain rendered — the AI commentary is the only piece that
 * surfaces this error.
 */
export function OptionsAiAnalysisError({
    resetErrorBoundary,
}: OptionsAiAnalysisErrorProps) {
    return (
        <section
            aria-labelledby="options-ai-analysis-heading"
            className="rounded-lg border border-secondary-700 bg-secondary-800 p-6"
            role="alert"
        >
            <h2
                id="options-ai-analysis-heading"
                className={cn('mb-3', HEADING_SECTION)}
            >
                AI 옵션 분석
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-secondary-300">
                옵션 분석을 가져오지 못했어요. 잠시 후 다시 시도해주세요.
            </p>
            {resetErrorBoundary ? (
                <button
                    type="button"
                    onClick={resetErrorBoundary}
                    className="mt-4 inline-flex items-center rounded-lg border border-border-control px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary-500 hover:text-primary-400 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                    다시 시도
                </button>
            ) : null}
        </section>
    );
}
