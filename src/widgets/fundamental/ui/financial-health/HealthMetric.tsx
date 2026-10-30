/**
 * 재무 건전성 카드의 지표 한 줄(라벨·툴팁·값·배지).
 */
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import type {
    BadgeVariant,
    HealthBadge,
} from '@/widgets/fundamental/utils/healthBadges';

const BADGE_VARIANT_CLASS: Record<BadgeVariant, string> = {
    good: 'bg-ui-success/10 text-ui-success-text',
    bad: 'bg-ui-danger/10 text-ui-danger-text',
    warn: 'bg-ui-warning/10 text-ui-warning-text',
    neutral: 'bg-secondary-700 text-secondary-400',
};

interface HealthMetricProps {
    label: string;
    value: string;
    hint?: string;
    badge?: HealthBadge;
    tooltip?: ReactNode;
}

/** 지표 라벨과 값을 좌우로 놓고, 구간 배지가 있으면 값 옆에 붙인다. */
export function HealthMetric({
    label,
    value,
    hint,
    badge,
    tooltip,
}: HealthMetricProps) {
    return (
        <div className="flex items-baseline justify-between gap-4 border-b border-secondary-700 py-2.5 last:border-b-0">
            <div>
                <span className="text-sm font-medium">{label}</span>
                {tooltip !== undefined && <InfoTooltip>{tooltip}</InfoTooltip>}
                {hint !== undefined && (
                    <span className="ml-1.5 text-xs text-secondary-400">
                        {hint}
                    </span>
                )}
            </div>
            <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-medium tabular-nums">
                    {value}
                </span>
                {badge !== undefined && (
                    <span
                        className={cn(
                            'rounded px-1.5 py-0.5 text-xs font-medium',
                            BADGE_VARIANT_CLASS[badge.variant]
                        )}
                    >
                        {badge.text}
                    </span>
                )}
            </div>
        </div>
    );
}
