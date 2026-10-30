/**
 * 내부자 거래 묶음 하나 — 좁은 화면은 카드, 넓은 화면은 표.
 */
import { useTranslations } from 'next-intl';
import type { InsiderTransaction } from '@y0ngha/siglens-core';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import { SURFACE_NESTED } from '@/shared/lib/surfaceStyles';
import { formatCompact, formatUsdCompact } from '../../utils/flowFormat';
import { shortRole } from '../../utils/insider';
import { insiderTradeKey } from '../../utils/insiderTradeKey';
import { FilingLink } from '../filings/FilingLink';
import { CardFieldList } from '../tables/CardFieldList';
import {
    ResponsiveRecordList,
    type RecordColumn,
} from '../tables/ResponsiveRecordList';
import { TypeBadge } from './TypeBadge';

interface TradeRecordsProps {
    readonly rows: readonly InsiderTransaction[];
    /** 표 캡션(스크린 리더) — 묶음마다 다르다. */
    readonly caption: string;
}

/** 금액을 모르는 거래는 대시로 둔다. 날짜는 ASCII라 mono, 금액·주식 수는 `tabular-nums`다. */
export function TradeRecords({ rows, caption }: TradeRecordsProps) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    const value = (tx: InsiderTransaction): string =>
        tx.value === null ? '–' : formatUsdCompact(tx.value, locale);
    const filingLink = (tx: InsiderTransaction) => (
        <FilingLink
            url={tx.url}
            label={t('insider.filing')}
            accessibleName={t('insider.filingLabel', { name: tx.name })}
        />
    );
    const columns: readonly RecordColumn[] = [
        { label: t('insider.colDate'), align: 'left' },
        { label: t('insider.colName'), align: 'left' },
        { label: t('insider.colType'), align: 'left' },
        { label: t('insider.colShares'), align: 'right' },
        { label: t('insider.colValue'), align: 'right' },
        { label: t('insider.colFiling'), align: 'right' },
    ];
    return (
        <ResponsiveRecordList
            caption={caption}
            columns={columns}
            cards={rows.map(tx => (
                <li
                    key={insiderTradeKey(tx)}
                    className={cn(SURFACE_NESTED, 'p-3')}
                >
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <p className="text-sm font-medium break-words text-secondary-100">
                                {tx.name}
                            </p>
                            <p className="text-xs text-secondary-400">
                                {shortRole(tx.role)}
                            </p>
                        </div>
                        <TypeBadge type={tx.type} />
                    </div>
                    <CardFieldList
                        fields={[
                            {
                                label: t('insider.colDate'),
                                value: tx.date,
                                mono: true,
                            },
                            {
                                label: t('insider.colShares'),
                                value: formatCompact(tx.shares, locale),
                            },
                            { label: t('insider.colValue'), value: value(tx) },
                        ]}
                    />
                    <div className="mt-2 text-right">{filingLink(tx)}</div>
                </li>
            ))}
            rows={rows.map(tx => (
                <tr
                    key={insiderTradeKey(tx)}
                    className="border-b border-secondary-700 last:border-b-0"
                >
                    <td className="py-2.5 pr-3 font-mono tabular-nums">
                        {tx.date}
                    </td>
                    <th
                        scope="row"
                        className="px-3 py-2.5 text-left font-medium text-secondary-100"
                    >
                        {tx.name}
                        <span className="block text-xs font-normal text-secondary-400">
                            {shortRole(tx.role)}
                        </span>
                    </th>
                    <td className="px-3 py-2.5">
                        <TypeBadge type={tx.type} />
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                        {formatCompact(tx.shares, locale)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                        {value(tx)}
                    </td>
                    <td className="py-2.5 pl-3 text-right">{filingLink(tx)}</td>
                </tr>
            ))}
        />
    );
}
