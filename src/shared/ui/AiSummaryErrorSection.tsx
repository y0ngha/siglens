'use client';

import type { FallbackProps } from 'react-error-boundary';
import { getFmpUserFacingMessage } from '@/shared/api/fmp/fmpUserMessage';
import { cn } from '@/shared/lib/cn';

export interface AiSummaryErrorSectionProps extends FallbackProps {
    /**
     * 섹션 제목 (예: "AI 펀더멘털 분석").
     * `aria-labelledby` 연결에도 사용되므로 각 서피스가 고유한 값을 전달해야 한다.
     */
    heading: string;
    /**
     * `aria-labelledby`에 쓰이는 heading 요소의 id.
     * 각 서피스가 문서 내에서 유일한 값을 전달한다.
     */
    idPrefix: string;
    /**
     * error instanceof Error도 아니고 getFmpUserFacingMessage도 null을 반환할 때
     * 보여줄 마지막 폴백 메시지.
     * 기본값: '분석 중 오류가 발생했습니다.'
     */
    fallbackMessage?: string;
    /**
     * 섹션에 추가할 className (예: 너비 제약이 필요한 뉴스 서피스).
     */
    className?: string;
}

/**
 * 4개 AI 분석 위젯(fundamental / financials / news / congress)이 공유하는 에러 셸.
 *
 * 단일 소스로 아래 세 가지 표준화를 보장한다:
 * - 메시지: getFmpUserFacingMessage → error.message → fallbackMessage 우선순위.
 * - 에러 텍스트 색: `text-ui-danger-text` (danger-on-surface 토큰).
 * - 재시도 버튼: 44px 최소 탭 타깃 (`min-h-11 inline-flex items-center px-3 py-2`).
 */
export function AiSummaryErrorSection({
    error,
    resetErrorBoundary,
    heading,
    idPrefix,
    fallbackMessage = '분석 중 오류가 발생했습니다.',
    className,
}: AiSummaryErrorSectionProps) {
    const headingId = `${idPrefix}-error-heading`;

    const message =
        getFmpUserFacingMessage(error) ??
        (error instanceof Error ? error.message : fallbackMessage);

    return (
        <section
            aria-labelledby={headingId}
            className={cn(
                'border-ui-danger/30 bg-secondary-800 rounded-xl border p-6',
                className
            )}
        >
            <h2
                id={headingId}
                className="mb-2 text-lg font-semibold tracking-tight"
            >
                {heading}
            </h2>
            <p className="text-ui-danger-text text-sm" role="alert">
                {message}
            </p>
            <button
                type="button"
                onClick={resetErrorBoundary}
                className="bg-primary-600 hover:bg-primary-700 focus-visible:ring-primary-500 focus-visible:ring-offset-secondary-800 mt-4 inline-flex min-h-11 items-center rounded px-3 py-2 text-xs text-white transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
                다시 시도
            </button>
        </section>
    );
}
