import type { FearGreedWarning } from '@y0ngha/siglens-core';

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

/**
 * Spec §9 self-norm paradox를 사용자에게 직접 노출하는 작은 ⚠️ 배지.
 * 분석 탭 카드 + 공포지수 탭에만 사용 (헤더 chip은 노이즈 회피).
 */
export function SelfNormWarningBadge({
    warning,
    className,
}: SelfNormWarningBadgeProps) {
    if (!warning) return null;
    return (
        <span
            className={`inline-flex items-center gap-1 rounded bg-yellow-900/30 px-2 py-0.5 text-xs text-yellow-200 ${className ?? ''}`}
            title={WARNING_TEXT[warning]}
            aria-label={WARNING_TEXT[warning]}
        >
            ⚠️ {WARNING_TEXT[warning]}
        </span>
    );
}
