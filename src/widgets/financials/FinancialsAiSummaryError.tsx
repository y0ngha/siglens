'use client';

import type { FallbackProps } from 'react-error-boundary';
import { AiSummaryErrorSection } from '@/shared/ui/AiSummaryErrorSection';
import { getFmpUserFacingMessage } from '@/shared/api/fmp/fmpUserMessage';

export function FinancialsAiSummaryError({
    error,
    resetErrorBoundary,
}: FallbackProps) {
    return (
        <AiSummaryErrorSection
            error={error}
            resetErrorBoundary={resetErrorBoundary}
            heading="AI 재무제표 분석"
            idPrefix="financials-ai-summary"
            getErrorMessage={getFmpUserFacingMessage}
        />
    );
}
