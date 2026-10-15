'use client';

import { useTranslations } from 'next-intl';
import type { FallbackProps } from 'react-error-boundary';
import { AiSummaryErrorSection } from '@/shared/ui/AiSummaryErrorSection';

export function InvestorFlowsSummaryError({
    error,
    resetErrorBoundary,
}: FallbackProps) {
    const t = useTranslations('widgets.investor-flows');
    return (
        <AiSummaryErrorSection
            error={error}
            onRetry={resetErrorBoundary}
            heading={t('ai.title')}
            idPrefix="investor-flows-summary"
            fallbackMessage={t('ai.errorFallback')}
        />
    );
}
