'use client';

import { useTranslations } from 'next-intl';
import type { StrikeVolume } from '../../utils/aggregateStrikeVolume';
import { StrikeTooltipRows } from '../strike-chart/StrikeTooltipRows';

interface StrikeVolumeTooltipBodyProps {
    row: StrikeVolume;
}

/** Hover tooltip content for one strike of the volume chart. */
export function StrikeVolumeTooltipBody({ row }: StrikeVolumeTooltipBodyProps) {
    const t = useTranslations('widgets.options');
    const format = (value: number): string =>
        t('StrikeVolumeChart.e3558e', { v0: value.toLocaleString() });

    return (
        <StrikeTooltipRows
            strike={row.strike}
            callLabel="Call Vol"
            putLabel="Put Vol"
            totalLabel={t('StrikeVolumeChart.3dcb27')}
            callValue={format(row.callVolume)}
            putValue={format(row.putVolume)}
            totalValue={format(row.callVolume + row.putVolume)}
        />
    );
}
