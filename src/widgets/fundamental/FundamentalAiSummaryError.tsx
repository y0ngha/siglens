'use client';

import type { FallbackProps } from 'react-error-boundary';
import { AiSummaryErrorSection } from '@/shared/ui/AiSummaryErrorSection';

export function FundamentalAiSummaryError({
    error,
    resetErrorBoundary,
}: FallbackProps) {
    return (
        <AiSummaryErrorSection
            error={error}
            resetErrorBoundary={resetErrorBoundary}
            heading="AI 펀더멘털 분석"
            idPrefix="ai-summary"
        />
    );
}
