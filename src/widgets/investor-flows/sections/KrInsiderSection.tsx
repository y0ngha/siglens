import { useTranslations } from 'next-intl';
import type { KrInsiderReport } from '@y0ngha/siglens-core';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { SURFACE_CARD, SURFACE_NESTED } from '@/shared/lib/surfaceStyles';
import { FlowTooltip } from '../investorFlowsTooltips';
import {
    formatCompact,
    formatInteger,
    formatPercent,
    formatSignedCompact,
    formatSignedDecimal,
} from '../utils/flowFormat';
import { insiderReportKey, newestKrRows } from '../utils/krDisclosures';
import { CollectingNotice } from './CollectingNotice';
import { DartFilingLink } from './DartFilingLink';

const HEADING_ID = 'flows-kr-insiders-heading';
/** 소유비율·증감(%p)의 소수 자리 — DART가 소수 둘째 자리까지 준다. */
const RATIO_DIGITS = 2;

function useRowText(row: KrInsiderReport) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    return {
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
    };
}

function InsiderCard({ row }: { readonly row: KrInsiderReport }) {
    const t = useTranslations('widgets.investor-flows');
    const text = useRowText(row);
    return (
        <li className={cn(SURFACE_NESTED, 'p-3')}>
            <p className="text-sm font-medium break-words text-secondary-100">
                {row.reporter}
            </p>
            <p className="text-xs text-secondary-400">{text.position}</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <dt className="text-secondary-400">{t('kr.colReceipt')}</dt>
                <dd className="text-right font-mono text-secondary-200 tabular-nums">
                    {row.receiptDate}
                </dd>
                <dt className="text-secondary-400">
                    {t('kr.insiders.colRegistered')}
                </dt>
                <dd className="text-right text-secondary-200">
                    {text.registered}
                </dd>
                <dt className="text-secondary-400">
                    {t('kr.insiders.colMajor')}
                </dt>
                <dd className="text-right text-secondary-200">
                    {text.majorShareholder}
                </dd>
                <dt className="text-secondary-400">
                    {t('kr.insiders.colShares')}
                </dt>
                <dd className="text-right text-secondary-200 tabular-nums">
                    {text.shares}{' '}
                    <span className="text-secondary-400">
                        ({text.sharesChange})
                    </span>
                </dd>
                <dt className="text-secondary-400">
                    {t('kr.insiders.colRatio')}
                </dt>
                <dd className="text-right text-secondary-200 tabular-nums">
                    {text.ratio}{' '}
                    <span className="text-secondary-400">
                        ({text.ratioChange})
                    </span>
                </dd>
            </dl>
            <div className="mt-2 text-right">
                <DartFilingLink url={row.url} reporter={row.reporter} />
            </div>
        </li>
    );
}

function InsiderTableRow({ row }: { readonly row: KrInsiderReport }) {
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
                <span className="block text-xs font-normal text-secondary-400">
                    {text.position}
                </span>
            </th>
            <td className="px-3 py-2.5 whitespace-nowrap">{text.registered}</td>
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
                <DartFilingLink url={row.url} reporter={row.reporter} />
            </td>
        </tr>
    );
}

interface KrInsiderSectionProps {
    readonly reports: readonly KrInsiderReport[];
    /** DART 초기 수집이 끝나지 않았고 이 종목 공시가 비어 있다. */
    readonly collecting: boolean;
}

function InsiderBody({ reports, collecting }: KrInsiderSectionProps) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    if (collecting) return <CollectingNotice variant="dart" />;
    const { rows, omittedCount } = newestKrRows(reports);
    if (rows.length === 0) {
        return (
            <p className="text-sm text-secondary-300">
                {t('kr.insiders.none')}
            </p>
        );
    }
    return (
        <>
            <ul className="space-y-2 md:hidden">
                {rows.map(row => (
                    <InsiderCard key={insiderReportKey(row)} row={row} />
                ))}
            </ul>
            <div className="hidden md:block">
                <table className="w-full text-sm">
                    <caption className="sr-only">
                        {t('kr.insiders.title')}
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
                                {t('kr.insiders.colReporter')}
                            </th>
                            <th
                                scope="col"
                                className="px-3 py-2 text-left font-medium"
                            >
                                {t('kr.insiders.colRegistered')}
                            </th>
                            <th
                                scope="col"
                                className="px-3 py-2 text-left font-medium"
                            >
                                {t('kr.insiders.colMajor')}
                            </th>
                            <th
                                scope="col"
                                className="px-3 py-2 text-right font-medium"
                            >
                                {t('kr.insiders.colShares')}
                            </th>
                            <th
                                scope="col"
                                className="px-3 py-2 text-right font-medium"
                            >
                                {t('kr.insiders.colRatio')}
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
                            <InsiderTableRow
                                key={insiderReportKey(row)}
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
 * 임원·주요주주 소유 보고(DART `elestock`) — 접수일, 보고자·직위, 등기 여부, 주요주주 여부, 소유 주식과 증감, 소유비율과 증감(%p),
 * DART 원문 링크. 보고서에는 증감의 원인(장내 매매·증여·상속·행사)이 없어서 캡션이 그 점을 밝힌다. 좁은 화면은 카드, 넓은 화면은 표다.
 */
export function KrInsiderSection(props: KrInsiderSectionProps) {
    const t = useTranslations('widgets.investor-flows');
    return (
        <section
            aria-labelledby={HEADING_ID}
            data-testid="flows-kr-insiders"
            className={cn(SURFACE_CARD, 'p-6')}
        >
            <h2 id={HEADING_ID} className={cn('mb-1', HEADING_SECTION)}>
                {t('kr.insiders.title')}
                <FlowTooltip term="krInsider" />
            </h2>
            <p className="mb-4 text-xs leading-relaxed text-secondary-400">
                {t('kr.insiders.caption')}
            </p>
            <InsiderBody {...props} />
        </section>
    );
}
