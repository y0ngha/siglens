import { cn } from '@/shared/lib/cn';
import type { BadgeClasses } from '../../utils/optionsAnalysisBadges';

interface AnalysisBadgeProps {
    label: string;
    classes: BadgeClasses;
}

/** Pill badge used by the tone and signal-kind indicators. */
export function AnalysisBadge({ label, classes }: AnalysisBadgeProps) {
    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium',
                classes.text,
                classes.bg,
                classes.border
            )}
        >
            {label}
        </span>
    );
}
