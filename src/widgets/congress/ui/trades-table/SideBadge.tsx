/** Buy/sell badge for a trades-table row. */
import { useTranslations } from 'next-intl';
import type { CongressTradeSide } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { SIDE_BG_CLASS, SIDE_CLASS, SIDE_LABEL } from '../../utils/tradeLabels';

interface SideBadgeProps {
    side: CongressTradeSide;
}

/** Sentinel is checked before translating: `t('')` returns a truthy fallback key string, not ''. */
export function SideBadge({ side }: SideBadgeProps) {
    const tLabel = useTranslations('shared.enumLabel');
    const sideKey = SIDE_LABEL[side];
    if (!sideKey) {
        return <span className={cn('text-xs', SIDE_CLASS[side])}>-</span>;
    }
    return (
        <span
            className={cn(
                'rounded px-1.5 py-0.5 text-xs font-medium',
                SIDE_BG_CLASS[side],
                SIDE_CLASS[side]
            )}
        >
            {tLabel(sideKey)}
        </span>
    );
}
