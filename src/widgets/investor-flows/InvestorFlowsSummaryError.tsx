'use client';

/**
 * AI 해석 오류 화면.
 */
import { useTranslations } from 'next-intl';
import type { FallbackProps } from 'react-error-boundary';
import { AiSummaryErrorSection } from '@/shared/ui/AiSummaryErrorSection';

/** AI 해석 오류 경계의 폴백 — 오류 메시지와 다시 시도를 보인다. */
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
