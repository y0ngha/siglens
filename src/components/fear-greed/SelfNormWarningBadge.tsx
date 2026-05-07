import type { FearGreedWarning } from '@y0ngha/siglens-core';
import { cn } from '@/lib/cn';

interface SelfNormWarningBadgeProps {
    warning: FearGreedWarning;
    className?: string;
}

const WARNING_TEXT: Record<NonNullable<FearGreedWarning>, string> = {
    CHRONIC_WEAKNESS:
        '이 종목은 장기 약세 사이클입니다. 점수는 자기 분포 대비 상대적 위치를 의미합니다.',
    CHRONIC_STRENGTH:
        '이 종목은 장기 강세 사이클입니다. 점수는 자기 분포 대비 상대적 위치를 의미합니다.',
};

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
                'bg-ui-warning/10 text-ui-warning border-ui-warning/30 inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs',
                className
            )}
        >
            <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
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
