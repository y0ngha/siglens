/**
 * 한국 임원·주요주주 소유 보고 목록 본문 — 좁은 화면은 카드, 넓은 화면은 표.
 */
import { useTranslations } from 'next-intl';
import type { KrInsiderReport } from '@y0ngha/siglens-core';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import { SURFACE_NESTED } from '@/shared/lib/surfaceStyles';
import {
    formatCompact,
    formatPercent,
    formatSignedCompact,
    formatSignedDecimal,
} from '../../utils/flowFormat';
import { krDisclosureKey } from '../../utils/krDisclosures';
import { DartFilingLink } from '../filings/DartFilingLink';
import { CardFieldList } from '../tables/CardFieldList';
import {
    ResponsiveRecordList,
    type RecordColumn,
} from '../tables/ResponsiveRecordList';

/** 소유비율·증감(%p)의 소수 자리 — DART가 소수 둘째 자리까지 준다. */
const RATIO_DIGITS = 2;

/** 임원·주요주주 소유 보고 목록(카드·표). */
export function InsiderReportRecords({
    rows,
}: {
    readonly rows: readonly KrInsiderReport[];
}) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    const textOf = (row: KrInsiderReport) => ({
        position: row.position ?? t('kr.insiders.positionNone'),
        registered: row.registered
            ? t('kr.insiders.registered')
            : t('kr.insiders.unregistered'),
        majorShareholder: row.majorShareholder
            ? t('kr.insiders.majorYes')
            : t('kr.insiders.majorNo'),
        shares: formatCompact(row.shares, locale),
        sharesChange: t('kr.change', {
            value: formatSignedCompact(row.sharesChange, locale),
        }),
        ratio: formatPercent(row.ratioPct, locale, RATIO_DIGITS),
        ratioChange: t('kr.pointChange', {
            value: formatSignedDecimal(
                row.ratioChangePct,
                locale,
                RATIO_DIGITS
            ),
        }),
    });
    const columns: readonly RecordColumn[] = [
        { label: t('kr.colReceipt'), align: 'left' },
        { label: t('kr.insiders.colReporter'), align: 'left' },
        { label: t('kr.insiders.colRegistered'), align: 'left' },
        { label: t('kr.insiders.colMajor'), align: 'left' },
        { label: t('kr.insiders.colShares'), align: 'right' },
        { label: t('kr.insiders.colRatio'), align: 'right' },
        { label: t('kr.colFiling'), align: 'right' },
    ];
    return (
        <ResponsiveRecordList
            caption={t('kr.insiders.title')}
            columns={columns}
            cards={rows.map(row => {
                const text = textOf(row);
                return (
                    <li
                        key={krDisclosureKey(row)}
                        className={cn(SURFACE_NESTED, 'p-3')}
                    >
                        <p className="text-sm font-medium break-words text-secondary-100">
                            {row.reporter}
                        </p>
                        <p className="text-xs text-secondary-400">
                            {text.position}
                        </p>
                        <CardFieldList
                            fields={[
                                {
                                    label: t('kr.colReceipt'),
                                    value: row.receiptDate,
                                    mono: true,
                                },
                                {
                                    label: t('kr.insiders.colRegistered'),
                                    value: text.registered,
                                },
                                {
                                    label: t('kr.insiders.colMajor'),
                                    value: text.majorShareholder,
                                },
                                {
                                    label: t('kr.insiders.colShares'),
                                    value: (
                                        <>
                                            {text.shares}{' '}
                                            <span className="text-secondary-400">
                                                ({text.sharesChange})
                                            </span>
                                        </>
                                    ),
                                },
                                {
                                    label: t('kr.insiders.colRatio'),
                                    value: (
                                        <>
                                            {text.ratio}{' '}
                                            <span className="text-secondary-400">
                                                ({text.ratioChange})
                                            </span>
                                        </>
                                    ),
                                },
                            ]}
                        />
                        <div className="mt-2 text-right">
                            <DartFilingLink
                                url={row.url}
                                reporter={row.reporter}
                            />
                        </div>
                    </li>
                );
            })}
            rows={rows.map(row => {
                const text = textOf(row);
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
                            <span className="block text-xs font-normal text-secondary-400">
                                {text.position}
                            </span>
                        </th>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                            {text.registered}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                            {text.majorShareholder}
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">
                            {text.shares}
                            <span className="block text-xs text-secondary-400">
                                {text.sharesChange}
                            </span>
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">
                            {text.ratio}
                            <span className="block text-xs text-secondary-400">
                                {text.ratioChange}
                            </span>
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
