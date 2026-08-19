'use client';

import { useTranslations } from 'next-intl';
import type { FallbackProps } from 'react-error-boundary';
import { AiSummaryErrorSection } from '@/shared/ui/AiSummaryErrorSection';
import { getFmpUserFacingMessage } from '@/shared/api/fmp/fmpUserMessage';

export function CongressTrendSummaryError({
    error,
    resetErrorBoundary,
}: FallbackProps) {
    const t = useTranslations('widgets.congress');
    return (
        <AiSummaryErrorSection
            error={error}
            resetErrorBoundary={resetErrorBoundary}
            heading={t('CongressTrendSummaryError.bbb041')}
            idPrefix="congress-trend-summary"
            fallbackMessage={t('CongressTrendSummaryError.dafb12')}
            getErrorMessage={getFmpUserFacingMessage}
        />
    );
}
