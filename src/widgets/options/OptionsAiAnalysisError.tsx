'use client';

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
            className="border-secondary-700 bg-secondary-800 rounded-xl border p-6"
            role="alert"
        >
            <p className="text-secondary-400 text-xs tracking-widest uppercase">
                AI 옵션 분석
            </p>
            <p className="text-secondary-300 mt-3 text-sm leading-relaxed">
                옵션 분석을 가져오지 못했어요. 잠시 후 다시 시도해주세요.
            </p>
            {resetErrorBoundary ? (
                <button
                    type="button"
                    onClick={resetErrorBoundary}
                    className="border-secondary-600 hover:border-primary-500 hover:text-primary-400 focus-visible:ring-primary-500 mt-4 inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                    다시 시도
                </button>
            ) : null}
        </section>
    );
}
