import { type CSSProperties } from 'react';
import { cn } from '@/shared/lib/cn';

const SKELETON_LINE_COUNT = 3;
const SKELETON_WIDTH_START_PCT = 85;
const SKELETON_WIDTH_STEP_PCT = 12;

export interface AiSummarySkeletonProps {
    /**
     * 섹션 제목 (예: "AI 펀더멘털 분석").
     * `aria-labelledby` 연결에도 사용된다.
     */
    heading: string;
    /**
     * `aria-labelledby`에 쓰이는 heading 요소의 id.
     * 각 서피스가 문서 내에서 유일한 값을 전달한다.
     */
    idPrefix: string;
    /**
     * 스피너 아래에 표시할 진행 메시지 (예: "AI 펀더멘털 분석 진행 중…").
     */
    progressMessage: string;
    /**
     * 섹션에 추가할 className (예: 너비 제약이 필요한 뉴스 서피스).
     */
    className?: string;
}

/**
 * 4개 AI 분석 위젯(fundamental / financials / news / congress)이 공유하는 로딩 스켈레톤 셸.
 *
 * 단일 소스로 아래 두 가지 표준화를 보장한다:
 * - 스피너와 펄스 라인 모두 `motion-reduce:animate-none` 포함.
 * - 3단계 너비 감소(85 → 73 → 61%)를 일관 적용.
 */
export function AiSummarySkeleton({
    heading,
    idPrefix,
    progressMessage,
    className,
}: AiSummarySkeletonProps) {
    const headingId = `${idPrefix}-loading-heading`;

    return (
        <section
            aria-labelledby={headingId}
            aria-busy="true"
            className={cn(
                'border-secondary-700 bg-secondary-800 rounded-xl border p-6',
                className
            )}
        >
            <h2
                id={headingId}
                className="mb-4 text-lg font-semibold tracking-tight"
            >
                {heading}
            </h2>
            <div className="flex items-center gap-3">
                <div
                    aria-hidden="true"
                    className="border-primary-500 h-4 w-4 animate-spin rounded-full border-2 border-t-transparent motion-reduce:animate-none"
                />
                <p
                    className="text-secondary-400 text-sm"
                    aria-live="polite"
                    aria-atomic="true"
                >
                    {progressMessage}
                </p>
            </div>
            <div className="mt-4 space-y-2">
                {[...Array(SKELETON_LINE_COUNT)].map((_, i) => (
                    <div
                        key={`skeleton-line-${i}`}
                        className="bg-secondary-700 h-4 w-(--skeleton-w) animate-pulse rounded motion-reduce:animate-none"
                        style={
                            {
                                '--skeleton-w': `${SKELETON_WIDTH_START_PCT - i * SKELETON_WIDTH_STEP_PCT}%`,
                            } as CSSProperties
                        }
                        aria-hidden="true"
                    />
                ))}
            </div>
        </section>
    );
}
