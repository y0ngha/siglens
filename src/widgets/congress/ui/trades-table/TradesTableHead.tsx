/** Column headers of the congress trades table. */
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import {
    AmountRangeTooltip,
    ChamberColumnTooltip,
    DisclosureLagTooltip,
} from '../../congressTooltips';

interface Column {
    label: string;
    tooltip?: ReactNode;
}

/** Tooltips live on the column header so rows stay free of per-row tooltip triggers. */
export function TradesTableHead() {
    const t = useTranslations('widgets.congress');

    /** Order must match the cells in `TradeRow`. */
    const columns: Column[] = [
        {
            label: t('CongressTradesTable.af2fee'),
            tooltip: ChamberColumnTooltip,
        },
        { label: t('CongressTradesTable.29c3ae') },
        { label: t('CongressTradesTable.67600a') },
        { label: t('CongressTradesTable.c8eed2'), tooltip: AmountRangeTooltip },
        { label: t('CongressTradesTable.29efb6') },
        { label: t('CongressTradesTable.e6fa15') },
        {
            label: t('CongressTradesTable.1ed947'),
            tooltip: DisclosureLagTooltip,
        },
        { label: t('CongressTradesTable.0c2cd8') },
        { label: t('CongressTradesTable.5073ef') },
        { label: t('CongressTradesTable.26d466') },
    ];

    return (
        <thead>
            <tr className="border-b border-secondary-700 text-xs text-secondary-400">
                {columns.map(({ label, tooltip }) => (
                    <th
                        key={label}
                        scope="col"
                        className="px-4 py-3 text-left font-medium whitespace-nowrap"
                    >
                        {label}
                        {tooltip && <InfoTooltip>{tooltip}</InfoTooltip>}
                    </th>
                ))}
            </tr>
        </thead>
    );
}
