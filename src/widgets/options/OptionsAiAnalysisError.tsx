'use client';

import { useTranslations } from 'next-intl';
import { AiSummaryErrorSection } from '@/shared/ui/AiSummaryErrorSection';

interface OptionsAiAnalysisErrorProps {
    resetErrorBoundary?: () => void;
}

/**
 * Fallback shown when the AI options analysis fails. The on-page metrics row
 * and OI chart remain rendered — the AI commentary is the only piece that
 * surfaces this error.
 *
 * The raw error is never shown: options failures are provider/stream errors
 * whose messages are not user-facing, so the fixed copy is always the message.
 */
export function OptionsAiAnalysisError({
    resetErrorBoundary,
}: OptionsAiAnalysisErrorProps) {
    const t = useTranslations('widgets.options');
    return (
        <AiSummaryErrorSection
            error={null}
            onRetry={resetErrorBoundary}
            heading={t('OptionsAiAnalysisError.eefb95')}
            idPrefix="options-ai-analysis"
            fallbackMessage={t('OptionsAiAnalysisError.e756f5')}
        />
    );
}
