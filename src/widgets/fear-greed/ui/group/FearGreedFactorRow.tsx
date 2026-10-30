import { useTranslations } from 'next-intl';
import { POC_WINDOW_DEFAULT, type FearGreedFactor } from '@y0ngha/siglens-core';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { formatFactorRaw } from '@/shared/lib/fearGreedLabels';
import { cn } from '@/shared/lib/cn';
import { isExtremePercentile } from '../../utils/percentile';

interface FearGreedFactorRowProps {
    factor: FearGreedFactor;
    /** 스냅샷의 표시용 200일선 이격(퍼센트) — `formatFactorRaw` 참고. */
    ma200DistancePct?: number | null;
}

/** 그룹 안 요인 한 줄: 이름, 원값, 백분위. 양 끝 10% 백분위는 굵게 강조한다. */
export function FearGreedFactorRow({
    factor,
    ma200DistancePct,
}: FearGreedFactorRowProps) {
    const t = useTranslations('widgets.fear-greed');
    const tFactor = useTranslations('shared.lib.fearGreedFactor');
    const locale = useResolvedLocale();
    const percentile = Math.round(factor.percentile);

    return (
        <li className="flex items-center justify-between">
            <span>
                -{' '}
                {tFactor(`symbolLabel.${factor.key}`, {
                    v0: POC_WINDOW_DEFAULT,
                })}
            </span>
            <span className="font-mono">
                {formatFactorRaw(
                    factor.key,
                    factor.rawValue,
                    locale,
                    ma200DistancePct
                )}
                <span
                    className={cn(
                        'ml-2',
                        isExtremePercentile(percentile)
                            ? 'text-secondary-300 font-semibold'
                            : 'text-secondary-500'
                    )}
                >
                    ({t('FearGreedGroupBar.percentile', { v0: percentile })})
                </span>
            </span>
        </li>
    );
}
