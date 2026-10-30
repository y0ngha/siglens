/**
 * 숏스퀴즈 수준 배지 — 색 + 막대 기호(▮) + 글자 세 겹으로 전한다.
 */
import { useTranslations } from 'next-intl';
import type { SqueezeRiskLevel } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { SQUEEZE_LEVEL_CLASS, SQUEEZE_LEVEL_MARK } from '../../utils/squeeze';

/** 숏스퀴즈 수준 배지. */
export function LevelBadge({ level }: { readonly level: SqueezeRiskLevel }) {
    const t = useTranslations('widgets.investor-flows');
    const levelLabels: Record<SqueezeRiskLevel, string> = {
        low: t('squeeze.level.low'),
        elevated: t('squeeze.level.elevated'),
        high: t('squeeze.level.high'),
        extreme: t('squeeze.level.extreme'),
    };
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium',
                SQUEEZE_LEVEL_CLASS[level]
            )}
        >
            <span aria-hidden="true">{SQUEEZE_LEVEL_MARK[level]}</span>
            {levelLabels[level]}
        </span>
    );
}
