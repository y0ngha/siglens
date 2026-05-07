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

/** Inline ⚠️ badge surfacing the self-norm paradox to users when the score may not reflect raw sentiment. */
export function SelfNormWarningBadge({
    warning,
    className,
}: SelfNormWarningBadgeProps) {
    if (!warning) return null;
    return (
        <span
            className={cn(
                'bg-ui-warning/10 text-ui-warning border-ui-warning/30 inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs',
                className
            )}
        >
            <span aria-hidden="true">⚠️</span>
            {WARNING_TEXT[warning]}
        </span>
    );
}
