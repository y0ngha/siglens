import { useTranslations } from 'next-intl';
import type {
    KrMajorHolderReport,
    KrMajorHolderReportForm,
} from '@y0ngha/siglens-core';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { SURFACE_CARD, SURFACE_NESTED } from '@/shared/lib/surfaceStyles';
import { FlowTooltip } from '../investorFlowsTooltips';
import {
    formatInteger,
    formatPercent,
    formatSignedCompact,
    formatSignedDecimal,
} from '../utils/flowFormat';
import { majorHolderKey, newestKrRows } from '../utils/krDisclosures';
import { CollectingNotice } from './CollectingNotice';
import { DartFilingLink } from './DartFilingLink';

const HEADING_ID = 'flows-kr-major-holders-heading';
/** 보유비율 증감(%p)의 소수 자리 — DART가 소수 둘째 자리까지 준다. */
const RATIO_DIGITS = 2;

function FormBadge({ form }: { readonly form: KrMajorHolderReportForm }) {
    const t = useTranslations('widgets.investor-flows');
    // 리터럴 `t()` 호출로 만들어 두고 고른다(추출기가 키를 볼 수 있게).
    const labels: Record<KrMajorHolderReportForm, string> = {
        detailed: t('kr.majorHolders.formDetailed'),
        abbreviated: t('kr.majorHolders.formAbbreviated'),
    };
    return (
        <span className="inline-flex items-center rounded bg-secondary-700 px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-secondary-200">
            {labels[form]}
        </span>
    );
}

function useRowText(row: KrMajorHolderReport) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    return {
        ratio: formatPercent(row.ratioPct, locale, RATIO_DIGITS),
        ratioChange: t('kr.pointChange', {
            value: formatSignedDecimal(
                row.ratioChangePct,
                locale,
                RATIO_DIGITS
            ),
        }),
        sharesChange: formatSignedCompact(row.sharesChange, locale),
        reason:
            row.reason === '' ? t('kr.majorHolders.reasonNone') : row.reason,
    };
}

function MajorHolderCard({ row }: { readonly row: KrMajorHolderReport }) {
    const t = useTranslations('widgets.investor-flows');
    const text = useRowText(row);
    return (
        <li className={cn(SURFACE_NESTED, 'p-3')}>
            <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 text-sm font-medium break-words text-secondary-100">
                    {row.reporter}
                </p>
                <FormBadge form={row.reportForm} />
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <dt className="text-secondary-400">{t('kr.colReceipt')}</dt>
                <dd className="text-right font-mono text-secondary-200 tabular-nums">
                    {row.receiptDate}
                </dd>
                <dt className="text-secondary-400">
                    {t('kr.majorHolders.colRatio')}
                </dt>
                <dd className="text-right text-secondary-200 tabular-nums">
                    {text.ratio}{' '}
                    <span className="text-secondary-400">
                        ({text.ratioChange})
                    </span>
                </dd>
                <dt className="text-secondary-400">
                    {t('kr.majorHolders.colSharesChange')}
                </dt>
                <dd className="text-right text-secondary-200 tabular-nums">
                    {text.sharesChange}
                </dd>
            </dl>
            <p className="mt-2 text-xs break-words text-secondary-300">
                {text.reason}
            </p>
            <div className="mt-2 text-right">
                <DartFilingLink url={row.url} reporter={row.reporter} />
            </div>
        </li>
    );
}

function MajorHolderTableRow({ row }: { readonly row: KrMajorHolderReport }) {
    const text = useRowText(row);
    return (
        <tr className="border-b border-secondary-700 last:border-b-0">
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
                <span className="block text-xs text-secondary-400">
                    {text.ratioChange}
                </span>
            </td>
            <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">
                {text.sharesChange}
            </td>
            <td className="px-3 py-2.5 text-xs break-words text-secondary-300">
                {text.reason}
            </td>
            <td className="py-2.5 pl-3 text-right">
                <DartFilingLink url={row.url} reporter={row.reporter} />
            </td>
        </tr>
    );
}

interface KrMajorHoldersSectionProps {
    readonly reports: readonly KrMajorHolderReport[];
    /** DART 초기 수집이 끝나지 않았고 이 종목 공시가 비어 있다. */
    readonly collecting: boolean;
}

function MajorHoldersBody({ reports, collecting }: KrMajorHoldersSectionProps) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    if (collecting) return <CollectingNotice variant="dart" />;
    const { rows, omittedCount } = newestKrRows(reports);
    if (rows.length === 0) {
        return (
            <p className="text-sm text-secondary-300">
                {t('kr.majorHolders.none')}
            </p>
        );
    }
    return (
        <>
            <ul className="space-y-2 md:hidden">
                {rows.map(row => (
                    <MajorHolderCard key={majorHolderKey(row)} row={row} />
                ))}
            </ul>
            <div className="hidden md:block">
                <table className="w-full text-sm">
                    <caption className="sr-only">
                        {t('kr.majorHolders.title')}
                    </caption>
                    <thead>
                        <tr className="border-b border-secondary-700 text-xs text-secondary-400">
                            <th
                                scope="col"
                                className="py-2 pr-3 text-left font-medium"
                            >
                                {t('kr.colReceipt')}
                            </th>
                            <th
                                scope="col"
                                className="px-3 py-2 text-left font-medium"
                            >
                                {t('kr.colReporter')}
                            </th>
                            <th
                                scope="col"
                                className="px-3 py-2 text-left font-medium"
                            >
                                {t('kr.majorHolders.colForm')}
                            </th>
                            <th
                                scope="col"
                                className="px-3 py-2 text-right font-medium"
                            >
                                {t('kr.majorHolders.colRatio')}
                            </th>
                            <th
                                scope="col"
                                className="px-3 py-2 text-right font-medium"
                            >
                                {t('kr.majorHolders.colSharesChange')}
                            </th>
                            <th
                                scope="col"
                                className="px-3 py-2 text-left font-medium"
                            >
                                {t('kr.majorHolders.colReason')}
                            </th>
                            <th
                                scope="col"
                                className="py-2 pl-3 text-right font-medium"
                            >
                                {t('kr.colFiling')}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(row => (
                            <MajorHolderTableRow
                                key={majorHolderKey(row)}
                                row={row}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
            {omittedCount > 0 && (
                <p className="mt-2 text-xs text-secondary-400">
                    {t('kr.omitted', {
                        count: formatInteger(omittedCount, locale),
                    })}
                </p>
            )}
        </>
    );
}

/**
 * 대량보유 보고(5% 이상, DART `majorstock`) — 접수일, 보고자, 보고 구분(일반·약식), 보유비율과 증감(%p), 보유 주식 증감, 사유,
 * DART 원문 링크. 좁은 화면은 카드, 넓은 화면은 표다(미국 Form 144 표와 같은 구성). 보고 구분은 서식 차이일 뿐 보유 목적을
 * 말하지 않는다는 점을 캡션·풀이로 밝힌다(core도 형식으로 강도를 정하지 않는다).
 */
export function KrMajorHoldersSection(props: KrMajorHoldersSectionProps) {
    const t = useTranslations('widgets.investor-flows');
    return (
        <section
            aria-labelledby={HEADING_ID}
            data-testid="flows-kr-major-holders"
            className={cn(SURFACE_CARD, 'p-6')}
        >
            <h2 id={HEADING_ID} className={cn('mb-1', HEADING_SECTION)}>
                {t('kr.majorHolders.title')}
                <FlowTooltip term="krMajorHolder" />
            </h2>
            <p className="mb-4 text-xs leading-relaxed text-secondary-400">
                {t('kr.majorHolders.caption')}
            </p>
            <MajorHoldersBody {...props} />
        </section>
    );
}
