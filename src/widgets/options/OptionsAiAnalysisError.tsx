'use client';

import { useTranslations } from 'next-intl';
import { AiSummaryErrorSection } from '@/shared/ui/AiSummaryErrorSection';

interface OptionsAiAnalysisErrorProps {
    resetErrorBoundary?: () => void;
    /**
     * User-facing message to show instead of the fixed copy. Only pass text
     * that is already localized for the user — `useOptionsAnalysis` builds its
     * thrown messages from `messages.*`, so `state.error.message` qualifies.
     */
    message?: string | null;
}

/**
 * Fallback shown when the AI options analysis fails. The on-page metrics row
 * and OI chart remain rendered — the AI commentary is the only piece that
 * surfaces this error.
 *
 * Two entry points: the analysis state's `error` branch passes the localized
 * `message`; the `ErrorBoundary` `FallbackComponent` path (a render crash)
 * passes none and shows the fixed copy. react-error-boundary's raw `error` is
 * never forwarded because a render crash message is not user-facing.
 */
export function OptionsAiAnalysisError({
    resetErrorBoundary,
    message = null,
}: OptionsAiAnalysisErrorProps) {
    const t = useTranslations('widgets.options');
    const fallbackMessage = t('OptionsAiAnalysisError.e756f5');
    return (
        <AiSummaryErrorSection
            error={message ? new Error(message) : null}
            onRetry={resetErrorBoundary}
            heading={t('OptionsAiAnalysisError.eefb95')}
            idPrefix="options-ai-analysis"
            fallbackMessage={fallbackMessage}
        />
    );
}
