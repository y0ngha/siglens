'use client';

import { useTranslations } from 'next-intl';
import { useQueryErrorResetBoundary } from '@tanstack/react-query';
import type { FallbackProps } from 'react-error-boundary';
import { translateFmpError } from '@/shared/api/fmp/fmpUserMessage';
import { AiSummaryErrorSection } from '@/shared/ui/AiSummaryErrorSection';

/**
 * 공포·탐욕 조회 실패 안내와 다시 시도 버튼.
 *
 * 에러 경계만 리셋하면 `useSuspenseQuery`가 캐시에 남은 같은 에러를 다시 던져 재시도가 아무
 * 일도 하지 않는다. 그래서 React Query 쪽 에러 리셋(`reset`)도 함께 불러, 경계가 다시 그릴 때
 * 실패한 쿼리가 새로 조회되게 한다.
 */
export function FearGreedPageError({
    error,
    resetErrorBoundary,
}: FallbackProps) {
    const t = useTranslations('widgets.fear-greed');
    const { reset: resetQueryError } = useQueryErrorResetBoundary();
    // FMP 문구 키는 완전 수식이라 루트 번역자가 필요하다.
    const tRoot = useTranslations();
    const fallbackMessage = t('FearGreedPageError.f929f0');

    // FMP 오류가 아니면 `error.message`(원문)가 아니라 고정 문구를 보인다 —
    // 그래서 추출기가 null을 돌려주지 않게 폴백까지 여기서 붙인다.
    return (
        <AiSummaryErrorSection
            error={error}
            onRetry={() => {
                resetQueryError();
                resetErrorBoundary();
            }}
            heading={t('FearGreedPageError.f9482c')}
            idPrefix="fear-greed"
            getErrorMessage={e =>
                translateFmpError(e, tRoot) ?? fallbackMessage
            }
        />
    );
}
