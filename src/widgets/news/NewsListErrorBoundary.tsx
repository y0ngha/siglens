'use client';

import type { ReactNode } from 'react';
import type { FallbackProps } from 'react-error-boundary';
import { ErrorBoundary } from 'react-error-boundary';

import { AiSummaryErrorSection } from '@/shared/ui/AiSummaryErrorSection';

/**
 * `NewsList`의 폴링 실패를 **섹션 안에서** 잡는다.
 *
 * `NewsList`는 지속되는 폴링 오류를 다시 던지며 "가장 가까운 에러 바운더리가
 * 전용 폴백을 그린다"고 적어 두었는데, 그 바운더리가 없었다 — 형제인
 * `NewsAiSummary`만 `NewsAiSummaryErrorBoundary`로 감싸여 있었고 `NewsList`는
 * `Suspense`만 있었다. 그래서 그 throw가 `[symbol]/error.tsx`까지 올라가
 * **심볼 라우트 전체**를 "데이터를 불러오지 못했어요" 한 장으로 바꿨다.
 *
 * 감사 실측(FMP 키 없는 리그, 양쪽 rig 동일): `/AAPL/news`가 SSR로 1,022자를
 * 정상 렌더한 뒤 몇 초 안에 h1이 오류 문구로 바뀌고 본문이 1,079 → 582자로
 * 줄었다. 헤더·탭 레일·관련 종목까지 함께 사라진다. 같은 결손을 `/options`는
 * "옵션 OI 데이터가 비어 있어요" 인라인 배너로 처리한다 — 그쪽이 옳은 모양이다.
 */
function NewsListError({ error, resetErrorBoundary }: FallbackProps) {
    return (
        <AiSummaryErrorSection
            error={error}
            resetErrorBoundary={resetErrorBoundary}
            heading="최근 뉴스"
            idPrefix="news-list"
            className="w-full max-w-full min-w-0 overflow-hidden"
        />
    );
}

interface NewsListErrorBoundaryProps {
    children: ReactNode;
}

export function NewsListErrorBoundary({
    children,
}: NewsListErrorBoundaryProps) {
    return (
        <ErrorBoundary FallbackComponent={NewsListError}>
            {children}
        </ErrorBoundary>
    );
}
