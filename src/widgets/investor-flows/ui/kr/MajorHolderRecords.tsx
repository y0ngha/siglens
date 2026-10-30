/**
 * 한국 대량보유 보고 목록 본문 — 좁은 화면은 카드, 넓은 화면은 표.
 */
import { useTranslations } from 'next-intl';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import { SURFACE_NESTED } from '@/shared/lib/surfaceStyles';
import {
    formatPercent,
    formatSignedCompact,
    formatSignedDecimal,
} from '../../utils/flowFormat';
import { krDisclosureKey } from '../../utils/krDisclosures';
import type { MajorHolderRowData } from '../../utils/krMajorHolders';
import { DartFilingLink } from '../filings/DartFilingLink';
import { CardFieldList } from '../tables/CardFieldList';
import {
    ResponsiveRecordList,
    type RecordColumn,
} from '../tables/ResponsiveRecordList';
import { FormBadge } from './FormBadge';

/** 보유비율 증감(%p)의 소수 자리 — DART가 소수 둘째 자리까지 준다. */
const RATIO_DIGITS = 2;

/** 대량보유 보고 목록(카드·표). */
export function MajorHolderRecords({
    rows,
}: {
    readonly rows: readonly MajorHolderRowData[];
}) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    const textOf = ({ row, ratioChangePct }: MajorHolderRowData) => ({
        ratio: formatPercent(row.ratioPct, locale, RATIO_DIGITS),
        // 증감은 최초 보고에서 계산할 수 없다(`null`) — 그때는 표시하지 않는다.
        ratioChange:
            ratioChangePct === null
                ? null
                : t('kr.pointChange', {
                      value: formatSignedDecimal(
                          ratioChangePct,
                          locale,
                          RATIO_DIGITS
                      ),
                  }),
        sharesChange: formatSignedCompact(row.sharesChange, locale),
        reason:
            row.reason === '' ? t('kr.majorHolders.reasonNone') : row.reason,
    });
    const columns: readonly RecordColumn[] = [
        { label: t('kr.colReceipt'), align: 'left' },
        { label: t('kr.colReporter'), align: 'left' },
        { label: t('kr.majorHolders.colForm'), align: 'left' },
        { label: t('kr.majorHolders.colRatio'), align: 'right' },
        { label: t('kr.majorHolders.colSharesChange'), align: 'right' },
        { label: t('kr.majorHolders.colReason'), align: 'left' },
        { label: t('kr.colFiling'), align: 'right' },
    ];
    return (
        <ResponsiveRecordList
            caption={t('kr.majorHolders.title')}
            columns={columns}
            cards={rows.map(entry => {
                const { row } = entry;
                const text = textOf(entry);
                return (
                    <li
                        key={krDisclosureKey(row)}
                        className={cn(SURFACE_NESTED, 'p-3')}
                    >
                        <div className="flex items-start justify-between gap-2">
                            <p className="min-w-0 text-sm font-medium break-words text-secondary-100">
                                {row.reporter}
                            </p>
                            <FormBadge form={row.reportForm} />
                        </div>
                        <CardFieldList
                            fields={[
                                {
                                    label: t('kr.colReceipt'),
                                    value: row.receiptDate,
                                    mono: true,
                                },
                                {
                                    label: t('kr.majorHolders.colRatio'),
                                    value: (
                                        <>
                                            {text.ratio}
                                            {text.ratioChange !== null && (
                                                <span className="text-secondary-400">
                                                    {' '}
                                                    ({text.ratioChange})
                                                </span>
                                            )}
                                        </>
                                    ),
                                },
                                {
                                    label: t('kr.majorHolders.colSharesChange'),
                                    value: text.sharesChange,
                                },
                            ]}
                        />
                        <p className="mt-2 text-xs break-words text-secondary-300">
                            {text.reason}
                        </p>
                        <div className="mt-2 text-right">
                            <DartFilingLink
                                url={row.url}
                                reporter={row.reporter}
                            />
                        </div>
                    </li>
                );
            })}
            rows={rows.map(entry => {
                const { row } = entry;
                const text = textOf(entry);
                return (
                    <tr
                        key={krDisclosureKey(row)}
                        className="border-b border-secondary-700 last:border-b-0"
                    >
                        <td className="py-2.5 pr-3 font-mono whitespace-nowrap tabular-nums">
                            {row.receiptDate}
                        </td>
                        <th
                            scope="row"
                            className="px-3 py-2.5 text-left font-medium break-words text-secondary-100"
                        >
                            {row.reporter}
                        </th>
                        <td className="px-3 py-2.5">
                            <FormBadge form={row.reportForm} />
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">
                            {text.ratio}
                            {text.ratioChange !== null && (
                                <span className="block text-xs text-secondary-400">
                                    {text.ratioChange}
                                </span>
                            )}
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">
                            {text.sharesChange}
                        </td>
                        <td className="px-3 py-2.5 text-xs break-words text-secondary-300">
                            {text.reason}
                        </td>
                        <td className="py-2.5 pl-3 text-right">
                            <DartFilingLink
                                url={row.url}
                                reporter={row.reporter}
                            />
                        </td>
                    </tr>
                );
            })}
        />
    );
}
