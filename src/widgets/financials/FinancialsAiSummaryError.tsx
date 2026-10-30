'use client';

/**
 * 재무 AI 요약 오류 카드 — FMP 오류 문구를 번역해 공용 오류 섹션에 넘긴다.
 */
import { useTranslations } from 'next-intl';
import type { FallbackProps } from 'react-error-boundary';
import { AiSummaryErrorSection } from '@/shared/ui/AiSummaryErrorSection';
import { translateFmpError } from '@/shared/api/fmp/fmpUserMessage';

/** 분석 실패를 보여 주고 재시도(`resetErrorBoundary`)를 연결한다. */
export function FinancialsAiSummaryError({
    error,
    resetErrorBoundary,
}: FallbackProps) {
    const t = useTranslations('widgets.financials');
    // FMP 문구 키는 완전 수식이라 루트 번역자가 필요하다.
    const tRoot = useTranslations();
    return (
        <AiSummaryErrorSection
            error={error}
            onRetry={resetErrorBoundary}
            heading={t('FinancialsAiSummaryError.26f860')}
            idPrefix="financials-ai-summary"
            getErrorMessage={error => translateFmpError(error, tRoot)}
        />
    );
}
