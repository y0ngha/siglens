import { useTranslations } from 'next-intl';
import type { BacktestAiEntryRecommendation } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';

interface EntryRecBadgeProps {
    recommendation: BacktestAiEntryRecommendation;
}

/** AI 진입 권고(진입/관망/회피) 배지. */
export function EntryRecBadge({ recommendation }: EntryRecBadgeProps) {
    const t = useTranslations('widgets.backtesting');
    const config: Record<
        BacktestAiEntryRecommendation,
        { label: string; cls: string }
    > = {
        enter: {
            label: t('BacktestCaseCard.0f8bf6'),
            cls: 'bg-ui-success/10 text-ui-success-text border-ui-success/30',
        },
        avoid: {
            label: t('BacktestCaseCard.6c8ca5'),
            cls: 'bg-ui-danger/10 text-ui-danger-text border-ui-danger/30',
        },
        wait: {
            label: t('BacktestCaseCard.540e42'),
            cls: 'bg-secondary-800 text-secondary-400 border-secondary-700',
        },
    };
    const { label, cls } = config[recommendation];
    return (
        <span
            translate="no"
            className={cn(
                'rounded border px-1.5 py-0.5 text-xs font-semibold',
                cls
            )}
        >
            {label}
        </span>
    );
}
