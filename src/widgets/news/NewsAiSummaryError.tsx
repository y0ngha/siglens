'use client';

import type { FallbackProps } from 'react-error-boundary';
import { AiSummaryErrorSection } from '@/shared/ui/AiSummaryErrorSection';

export function NewsAiSummaryError({
    error,
    resetErrorBoundary,
}: FallbackProps) {
    return (
        <AiSummaryErrorSection
            error={error}
            resetErrorBoundary={resetErrorBoundary}
            heading="AI 뉴스 종합 분석"
            idPrefix="news-ai-summary"
            className="w-full max-w-full min-w-0 overflow-hidden"
        />
    );
}
