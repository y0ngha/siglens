'use client';

import { useTranslations } from 'next-intl';
import type { FallbackProps } from 'react-error-boundary';
import { AiSummaryErrorSection } from '@/shared/ui/AiSummaryErrorSection';

export function NewsAiSummaryError({
    error,
    resetErrorBoundary,
}: FallbackProps) {
    const t = useTranslations('widgets.news');
    return (
        <AiSummaryErrorSection
            error={error}
            resetErrorBoundary={resetErrorBoundary}
            heading={t('NewsAiSummaryError.ed8166')}
            idPrefix="news-ai-summary"
            className="w-full max-w-full min-w-0 overflow-hidden"
        />
    );
}
