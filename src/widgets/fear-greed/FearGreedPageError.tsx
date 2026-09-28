'use client';

import { useTranslations } from 'next-intl';
import type { FallbackProps } from 'react-error-boundary';
import { translateFmpError } from '@/shared/api/fmp/fmpUserMessage';
import { AiSummaryErrorSection } from '@/shared/ui/AiSummaryErrorSection';

export function FearGreedPageError({
    error,
    resetErrorBoundary,
}: FallbackProps) {
    const t = useTranslations('widgets.fear-greed');
    // FMP 문구 키는 완전 수식이라 루트 번역자가 필요하다.
    const tRoot = useTranslations();
    const fallbackMessage = t('FearGreedPageError.f929f0');

    // FMP 오류가 아니면 `error.message`(원문)가 아니라 고정 문구를 보인다 —
    // 그래서 추출기가 null을 돌려주지 않게 폴백까지 여기서 붙인다.
    return (
        <AiSummaryErrorSection
            error={error}
            onRetry={resetErrorBoundary}
            heading={t('FearGreedPageError.f9482c')}
            idPrefix="fear-greed"
            getErrorMessage={e =>
                translateFmpError(e, tRoot) ?? fallbackMessage
            }
        />
    );
}
