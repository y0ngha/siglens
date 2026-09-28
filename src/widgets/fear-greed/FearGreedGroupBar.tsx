import { useTranslations } from 'next-intl';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { POC_WINDOW_DEFAULT, type FearGreedGroup } from '@y0ngha/siglens-core';
import { formatFactorRaw } from '@/shared/lib/fearGreedLabels';
import { cn } from '@/shared/lib/cn';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import { FearGreedScoreBar } from '@/shared/ui/FearGreedScoreBar';

interface FearGreedGroupBarProps {
    group: FearGreedGroup;
}

const EXTREME_PERCENTILE_LOW = 10;
const EXTREME_PERCENTILE_HIGH = 90;

export function FearGreedGroupBar({ group }: FearGreedGroupBarProps) {
    const t = useTranslations('widgets.fear-greed');
    const tFactor = useTranslations('shared.lib.fearGreedFactor');
    const score = Math.round(group.score);
    const locale = useResolvedLocale();
    return (
        <section className="flex flex-col gap-2 rounded bg-secondary-800/40 p-3">
            <header className="flex items-center justify-between">
                <h3 className={HEADING_SUBSECTION}>{group.name} Group</h3>
                <span className="font-mono text-sm text-secondary-100">
                    {score} / 100
                </span>
            </header>
            <FearGreedScoreBar
                value={score}
                label={t('FearGreedGroupBar.groupScore', {
                    v0: group.name,
                    v1: score,
                })}
            />
            <ul className="flex flex-col gap-1 text-xs text-secondary-400">
                {group.factors.map(f => {
                    const pctile = Math.round(f.percentile);
                    const isExtreme =
                        pctile < EXTREME_PERCENTILE_LOW ||
                        pctile >= EXTREME_PERCENTILE_HIGH;
                    return (
                        <li
                            key={f.key}
                            className="flex items-center justify-between"
                        >
                            <span>
                                ·{' '}
                                {tFactor(`symbolLabel.${f.key}`, {
                                    v0: POC_WINDOW_DEFAULT,
                                })}
                            </span>
                            <span className="font-mono">
                                {formatFactorRaw(f.key, f.rawValue, locale)}
                                <span
                                    className={cn(
                                        'ml-2',
                                        isExtreme
                                            ? 'text-secondary-300 font-semibold'
                                            : 'text-secondary-500'
                                    )}
                                >
                                    ({pctile}th)
                                </span>
                            </span>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
