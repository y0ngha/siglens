/**
 * 매도 예정 신고(Form 144) 목록 본문 — 좁은 화면은 카드, 넓은 화면은 표.
 */
import { useTranslations } from 'next-intl';
import type { ProposedSale } from '@y0ngha/siglens-core';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import { SURFACE_NESTED } from '@/shared/lib/surfaceStyles';
import { formatCompact, formatUsdCompact } from '../../utils/flowFormat';
import { proposedSaleKey } from '../../utils/secFilings';
import { FilingLink } from '../filings/FilingLink';
import { CardFieldList } from '../tables/CardFieldList';
import {
    ResponsiveRecordList,
    type RecordColumn,
} from '../tables/ResponsiveRecordList';
import { PlanBadge } from './PlanBadge';

/** 예정일을 모르는 신고는 대시로 둔다. */
const UNKNOWN_DATE = '–';

/** 신고자와 내부자의 관계(임원·이사 등). 관계를 모르면 안내 문구다. */
export function ProposedSaleRecords({
    sales,
}: {
    readonly sales: readonly ProposedSale[];
}) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    const relationships = (sale: ProposedSale): string =>
        sale.relationships.length === 0
            ? t('form144.relationshipUnknown')
            : sale.relationships.join(', ');
    const filingLink = (sale: ProposedSale) => (
        <FilingLink
            url={sale.url}
            label={t('form144.filing')}
            accessibleName={t('form144.filingLabel', { filer: sale.filer })}
        />
    );
    const columns: readonly RecordColumn[] = [
        { label: t('form144.colFiled'), align: 'left' },
        { label: t('form144.colFiler'), align: 'left' },
        { label: t('form144.colShares'), align: 'right' },
        { label: t('form144.colValue'), align: 'right' },
        { label: t('form144.colSaleDate'), align: 'left' },
        { label: t('form144.colFiling'), align: 'right' },
    ];
    return (
        <ResponsiveRecordList
            caption={t('form144.title')}
            columns={columns}
            cards={sales.map(sale => (
                <li
                    key={proposedSaleKey(sale)}
                    className={cn(SURFACE_NESTED, 'p-3')}
                >
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <p className="text-sm font-medium break-words text-secondary-100">
                                {sale.filer}
                            </p>
                            <p className="text-xs text-secondary-400">
                                {relationships(sale)}
                            </p>
                        </div>
                        {sale.planAdoptionDate !== null && <PlanBadge />}
                    </div>
                    <CardFieldList
                        fields={[
                            {
                                label: t('form144.colFiled'),
                                value: sale.filingDate,
                                mono: true,
                            },
                            {
                                label: t('form144.colShares'),
                                value: formatCompact(sale.shares, locale),
                            },
                            {
                                label: t('form144.colValue'),
                                value: formatUsdCompact(sale.valueUsd, locale),
                            },
                            {
                                label: t('form144.colSaleDate'),
                                value: sale.approxSaleDate ?? UNKNOWN_DATE,
                                mono: true,
                            },
                        ]}
                    />
                    <div className="mt-2 text-right">{filingLink(sale)}</div>
                </li>
            ))}
            rows={sales.map(sale => (
                <tr
                    key={proposedSaleKey(sale)}
                    className="border-b border-secondary-700 last:border-b-0"
                >
                    <td className="py-2.5 pr-3 font-mono tabular-nums">
                        {sale.filingDate}
                    </td>
                    <th
                        scope="row"
                        className="px-3 py-2.5 text-left font-medium text-secondary-100"
                    >
                        <span className="flex flex-wrap items-center gap-2">
                            {sale.filer}
                            {sale.planAdoptionDate !== null && <PlanBadge />}
                        </span>
                        <span className="block text-xs font-normal text-secondary-400">
                            {relationships(sale)}
                        </span>
                    </th>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                        {formatCompact(sale.shares, locale)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                        {formatUsdCompact(sale.valueUsd, locale)}
                    </td>
                    <td className="px-3 py-2.5 font-mono tabular-nums">
                        {sale.approxSaleDate ?? UNKNOWN_DATE}
                    </td>
                    <td className="py-2.5 pl-3 text-right">
                        {filingLink(sale)}
                    </td>
                </tr>
            ))}
        />
    );
}
