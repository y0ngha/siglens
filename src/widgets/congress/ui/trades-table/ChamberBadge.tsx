/** Chamber (senate/house) badge for a trades-table row. */
import { useTranslations } from 'next-intl';
import type { Chamber } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { CHAMBER_BADGE_CLASS, CHAMBER_LABEL } from '../../utils/tradeLabels';

interface ChamberBadgeProps {
    chamber: Chamber;
}

/** The visible text is the accessible name — no aria-label (prohibited on a role-less span and redundant). */
export function ChamberBadge({ chamber }: ChamberBadgeProps) {
    const tLabel = useTranslations('shared.enumLabel');

    return (
        <span
            className={cn(
                'rounded px-1.5 py-0.5 text-xs font-medium',
                CHAMBER_BADGE_CLASS[chamber]
            )}
        >
            {tLabel(CHAMBER_LABEL[chamber])}
        </span>
    );
}
