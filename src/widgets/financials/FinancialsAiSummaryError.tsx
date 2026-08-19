'use client';

import { useTranslations } from 'next-intl';
import type { FallbackProps } from 'react-error-boundary';
import { AiSummaryErrorSection } from '@/shared/ui/AiSummaryErrorSection';
import { getFmpUserFacingMessage } from '@/shared/api/fmp/fmpUserMessage';

export function FinancialsAiSummaryError({
    error,
    resetErrorBoundary,
}: FallbackProps) {
    const t = useTranslations('widgets.financials');
    return (
        <AiSummaryErrorSection
            error={error}
            resetErrorBoundary={resetErrorBoundary}
            heading={t('FinancialsAiSummaryError.26f860')}
            idPrefix="financials-ai-summary"
            getErrorMessage={getFmpUserFacingMessage}
        />
    );
}
