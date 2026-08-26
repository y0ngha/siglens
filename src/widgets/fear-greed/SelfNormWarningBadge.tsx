import type { FearGreedWarning } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
// 문구 자체는 `shared/lib/fearGreedLabels`가 소유한다 — 서버 렌더 요약
// (`FearGreedFactsSummary`)이 이 클라이언트 모듈을 끌어오지 않게 하기 위함.
// 기존 소비자(테스트 포함)의 import 경로를 지키려고 여기서 다시 내보낸다.
import { WARNING_TEXT } from '@/shared/lib/fearGreedLabels';

export { WARNING_TEXT };

interface SelfNormWarningBadgeProps {
    warning: FearGreedWarning;
    className?: string;
}

/** Heroicons exclamation-triangle outline 변형의 표준 stroke width (24px viewBox 기준). */
const WARNING_ICON_STROKE_WIDTH = 2;

/** Inline warning badge surfacing the self-norm paradox to users when the score may not reflect raw sentiment. */
export function SelfNormWarningBadge({
    warning,
    className,
}: SelfNormWarningBadgeProps) {
    if (!warning) return null;
    return (
        <span
            role="status"
            className={cn(
                'bg-ui-warning/10 text-ui-warning-text border-ui-warning/30 inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs',
                className
            )}
        >
            <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={WARNING_ICON_STROKE_WIDTH}
                className="h-4 w-4 shrink-0"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.008v.008H12v-.008Z"
                />
            </svg>
            {WARNING_TEXT[warning]}
        </span>
    );
}
