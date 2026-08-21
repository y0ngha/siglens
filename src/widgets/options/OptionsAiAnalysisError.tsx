'use client';
import { useTranslations } from 'next-intl';

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
    const t = useTranslations('widgets.options');
    return (
        <section
            className="rounded-xl border border-secondary-700 bg-secondary-800 p-6"
            role="alert"
        >
            <p className="text-xs tracking-widest text-secondary-400 uppercase">
                {t('OptionsAiAnalysisError.eefb95')}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-secondary-300">
                {t('OptionsAiAnalysisError.e756f5')}
            </p>
            {resetErrorBoundary ? (
                <button
                    type="button"
                    onClick={resetErrorBoundary}
                    className="mt-4 inline-flex items-center rounded-md border border-secondary-600 px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary-500 hover:text-primary-400 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                    {t('OptionsAiAnalysisError.0c767c')}
                </button>
            ) : null}
        </section>
    );
}
