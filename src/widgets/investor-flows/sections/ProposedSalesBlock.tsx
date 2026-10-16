import { useTranslations } from 'next-intl';
import type { ProposedSale } from '@y0ngha/siglens-core';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import { toSafeHttpUrl } from '@/shared/lib/safeUrl';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import { SURFACE_NESTED } from '@/shared/lib/surfaceStyles';
import { FlowTooltip } from '../investorFlowsTooltips';
import {
    formatCompact,
    formatInteger,
    formatUsdCompact,
} from '../utils/flowFormat';
import { buildProposedSaleRows, proposedSaleKey } from '../utils/secFilings';
import { CollectingNotice } from './CollectingNotice';

const LINK_CLASS =
    'tap-target rounded text-xs text-primary-400 underline transition-colors hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

function PlanBadge() {
    const t = useTranslations('widgets.investor-flows');
    return (
        <span className="inline-flex items-center rounded bg-secondary-700 px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-secondary-200">
            {t('form144.planBadge')}
        </span>
    );
}

function FilingLink({ url }: { readonly url: string }) {
    const t = useTranslations('widgets.investor-flows');
    const href = toSafeHttpUrl(url);
    if (href === null)
        return <span className="text-xs text-secondary-400">–</span>;
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={LINK_CLASS}
        >
            {t('form144.filing')}
        </a>
    );
}

interface ProposedSalesBlockProps {
    /** `undefined` = 이 원천이 스냅샷에 없다(조회 실패). */
    readonly sales: readonly ProposedSale[] | undefined;
    /** 공시 수집이 최근까지 따라잡지 못했다(구간이 비어 있을 때만 참). */
    readonly collecting: boolean;
}

/** 수집 중 → 조회 불가 → 신고 없음 → 목록 순으로 첫 해당 분기만 그린다. 좁은 화면은 카드, 넓은 화면은 표다. */
function ProposedSalesBody({ sales, collecting }: ProposedSalesBlockProps) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    if (collecting) return <CollectingNotice variant="filings" />;
    if (sales === undefined) {
        return (
            <p className="text-sm text-secondary-300">
                {t('form144.unavailable')}
            </p>
        );
    }
    const { rows, omittedCount } = buildProposedSaleRows(sales);
    if (rows.length === 0) {
        return (
            <p className="text-sm text-secondary-300">{t('form144.none')}</p>
        );
    }
    const relationships = (sale: ProposedSale): string =>
        sale.relationships.length === 0
            ? t('form144.relationshipUnknown')
            : sale.relationships.join(', ');
    return (
        <>
            <ul className="space-y-2 md:hidden">
                {rows.map(sale => (
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
                        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                            <dt className="text-secondary-400">
                                {t('form144.colFiled')}
                            </dt>
                            <dd className="text-right font-mono text-secondary-200 tabular-nums">
                                {sale.filingDate}
                            </dd>
                            <dt className="text-secondary-400">
                                {t('form144.colShares')}
                            </dt>
                            <dd className="text-right text-secondary-200 tabular-nums">
                                {formatCompact(sale.shares, locale)}
                            </dd>
                            <dt className="text-secondary-400">
                                {t('form144.colValue')}
                            </dt>
                            <dd className="text-right text-secondary-200 tabular-nums">
                                {formatUsdCompact(sale.valueUsd, locale)}
                            </dd>
                            <dt className="text-secondary-400">
                                {t('form144.colSaleDate')}
                            </dt>
                            <dd className="text-right font-mono text-secondary-200 tabular-nums">
                                {sale.approxSaleDate ?? '–'}
                            </dd>
                        </dl>
                        <div className="mt-2 text-right">
                            <FilingLink url={sale.url} />
                        </div>
                    </li>
                ))}
            </ul>
            <div className="hidden md:block">
                <table className="w-full text-sm">
                    <caption className="sr-only">{t('form144.title')}</caption>
                    <thead>
                        <tr className="border-b border-secondary-700 text-xs text-secondary-400">
                            <th
                                scope="col"
                                className="py-2 pr-3 text-left font-medium"
                            >
                                {t('form144.colFiled')}
                            </th>
                            <th
                                scope="col"
                                className="px-3 py-2 text-left font-medium"
                            >
                                {t('form144.colFiler')}
                            </th>
                            <th
                                scope="col"
                                className="px-3 py-2 text-right font-medium"
                            >
                                {t('form144.colShares')}
                            </th>
                            <th
                                scope="col"
                                className="px-3 py-2 text-right font-medium"
                            >
                                {t('form144.colValue')}
                            </th>
                            <th
                                scope="col"
                                className="px-3 py-2 text-left font-medium"
                            >
                                {t('form144.colSaleDate')}
                            </th>
                            <th
                                scope="col"
                                className="py-2 pl-3 text-right font-medium"
                            >
                                {t('form144.colFiling')}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(sale => (
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
                                        {sale.planAdoptionDate !== null && (
                                            <PlanBadge />
                                        )}
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
                                    {sale.approxSaleDate ?? '–'}
                                </td>
                                <td className="py-2.5 pl-3 text-right">
                                    <FilingLink url={sale.url} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {omittedCount > 0 && (
                <p className="mt-2 text-xs text-secondary-400">
                    {t('form144.omitted', {
                        count: formatInteger(omittedCount, locale),
                    })}
                </p>
            )}
        </>
    );
}

/**
 * 매도 예정 신고(Form 144) — 계열인(임원·이사·대주주)이 주식을 팔기 전에 내는 신고. 신고일, 신고자·관계, 예정 수량·금액,
 * 예정일, 10b5-1 계획 배지, SEC 원문 링크. 신고는 "팔 수 있다"는 예고일 뿐 실제 매도는 Form 4로 따로 나온다는 점을 밝힌다.
 */
export function ProposedSalesBlock(props: ProposedSalesBlockProps) {
    const t = useTranslations('widgets.investor-flows');
    return (
        <div data-testid="flows-form144">
            <h3 className={cn('mb-1', HEADING_SUBSECTION)}>
                {t('form144.title')}
                <FlowTooltip term="form144" />
            </h3>
            <p className="mb-3 text-xs text-secondary-400">
                {t('form144.caption')}
            </p>
            <ProposedSalesBody {...props} />
        </div>
    );
}
