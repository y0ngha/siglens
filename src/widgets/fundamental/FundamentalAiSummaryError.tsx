'use client';

import { useTranslations } from 'next-intl';
import type { FallbackProps } from 'react-error-boundary';
import { AiSummaryErrorSection } from '@/shared/ui/AiSummaryErrorSection';
import { translateFmpError } from '@/shared/api/fmp/fmpUserMessage';

export function FundamentalAiSummaryError({
    error,
    resetErrorBoundary,
}: FallbackProps) {
    const t = useTranslations('widgets.fundamental');
    // FMP 문구 키는 완전 수식이라 루트 번역자가 필요하다.
    const tRoot = useTranslations();
    return (
        <AiSummaryErrorSection
            error={error}
            resetErrorBoundary={resetErrorBoundary}
            heading={t('FundamentalAiSummaryError.17769c')}
            idPrefix="ai-summary"
            getErrorMessage={error => translateFmpError(error, tRoot)}
        />
    );
}
