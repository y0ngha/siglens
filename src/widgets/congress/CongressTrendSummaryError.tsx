'use client';

import { useTranslations } from 'next-intl';
import type { FallbackProps } from 'react-error-boundary';
import { AiSummaryErrorSection } from '@/shared/ui/AiSummaryErrorSection';
import { translateFmpError } from '@/shared/api/fmp/fmpUserMessage';

export function CongressTrendSummaryError({
    error,
    resetErrorBoundary,
}: FallbackProps) {
    const t = useTranslations('widgets.congress');
    // FMP 문구 키는 완전 수식이라 루트 번역자가 필요하다.
    const tRoot = useTranslations();
    return (
        <AiSummaryErrorSection
            error={error}
            resetErrorBoundary={resetErrorBoundary}
            heading={t('CongressTrendSummaryError.bbb041')}
            idPrefix="congress-trend-summary"
            fallbackMessage={t('CongressTrendSummaryError.dafb12')}
            getErrorMessage={error => translateFmpError(error, tRoot)}
        />
    );
}
