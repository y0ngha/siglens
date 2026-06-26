'use client';

import type { FallbackProps } from 'react-error-boundary';
import { AiSummaryErrorSection } from '@/shared/ui/AiSummaryErrorSection';
import { getFmpUserFacingMessage } from '@/shared/api/fmp/fmpUserMessage';

export function CongressTrendSummaryError({
    error,
    resetErrorBoundary,
}: FallbackProps) {
    return (
        <AiSummaryErrorSection
            error={error}
            resetErrorBoundary={resetErrorBoundary}
            heading="AI 동향 해석"
            idPrefix="congress-trend-summary"
            fallbackMessage="동향 해석 중 오류가 발생했습니다."
            getErrorMessage={getFmpUserFacingMessage}
        />
    );
}
