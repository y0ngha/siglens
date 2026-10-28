import { useTranslations } from 'next-intl';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { FearGreedGauge } from '@/shared/ui/FearGreedGauge';
import { cn } from '@/shared/lib/cn';
import type { ComparisonTile } from '../../utils/comparisonTiles';
import { formatTileDate } from '../../utils/formatTileDate';

interface FearGreedComparisonTileProps {
    tile: ComparisonTile;
}

/**
 * 비교 게이지 한 칸. history가 그 기간까지 닿지 않으면(`tile.clamped`) 가장 오래된 기록으로
 * 대신한 것이므로, 기간 이름 옆에 실제 날짜를 적어 "1년 전"으로 오해하지 않게 한다.
 */
export function FearGreedComparisonTile({
    tile,
}: FearGreedComparisonTileProps) {
    const t = useTranslations('widgets.fear-greed');
    const tPeriod = useTranslations('shared.ui.period');
    const locale = useResolvedLocale();
    const period = tPeriod(tile.periodMessageKey);
    const periodLabel = tile.clamped
        ? t('FearGreedComparisonTile.sincePeriod', {
              v0: period,
              v1: formatTileDate(tile.date, locale),
          })
        : period;

    return (
        <li
            className={cn(
                'rounded-lg border p-1',
                // `현재` 타일이 나머지와 구분되는 신호가 보더뿐이라 알파를 걷어내 강조와
                // 기본 보더를 실제로 벌린다. 상태가 색에만 의존하지는 않는다 — 각 타일
                // 아래에 `현재`·`1주` 같은 라벨이 그대로 있다.
                tile.key === 'now'
                    ? 'border-primary-500'
                    : 'border-secondary-700'
            )}
        >
            <FearGreedGauge
                score={tile.score}
                label={tile.label}
                size="mini"
                periodLabel={periodLabel}
            />
        </li>
    );
}
