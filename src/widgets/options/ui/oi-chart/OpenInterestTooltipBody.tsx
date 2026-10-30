'use client';

import { useTranslations } from 'next-intl';
import type { StrikeOpenInterest } from '@y0ngha/siglens-core';
import { StrikeTooltipRows } from '../strike-chart/StrikeTooltipRows';

interface OpenInterestTooltipBodyProps {
    row: StrikeOpenInterest;
}

/** Hover tooltip content for one strike of the open-interest chart. */
export function OpenInterestTooltipBody({ row }: OpenInterestTooltipBodyProps) {
    const t = useTranslations('widgets.options');
    const format = (value: number): string =>
        t('OpenInterestChart.e3558e', { v0: value.toLocaleString() });

    return (
        <StrikeTooltipRows
            strike={row.strike}
            callLabel="Call OI"
            putLabel="Put OI"
            totalLabel={t('OpenInterestChart.3dcb27')}
            callValue={format(row.callOpenInterest)}
            putValue={format(row.putOpenInterest)}
            totalValue={format(row.callOpenInterest + row.putOpenInterest)}
        />
    );
}
