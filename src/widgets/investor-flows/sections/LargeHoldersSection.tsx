import { useTranslations } from 'next-intl';
import type { LargeHolderFiling } from '@y0ngha/siglens-core';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import { toSafeHttpUrl } from '@/shared/lib/safeUrl';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { SURFACE_CARD, SURFACE_NESTED } from '@/shared/lib/surfaceStyles';
import { FlowTooltip } from '../investorFlowsTooltips';
import { formatCompact, formatPercent } from '../utils/flowFormat';
import {
    buildLargeHolderRows,
    largeHolderKind,
    type LargeHolderKind,
} from '../utils/largeHolders';

const HEADING_ID = 'flows-large-holders-heading';

const KIND_CLASS: Record<LargeHolderKind, string> = {
    '13d': 'bg-ui-warning/10 text-ui-warning-text',
    '13g': 'bg-secondary-700 text-secondary-300',
    other: 'bg-secondary-700 text-secondary-300',
};

const LINK_CLASS =
    'tap-target rounded text-xs text-primary-400 underline transition-colors hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

interface LargeHoldersSectionProps {
    /** `null` = 13D/13G 조회 실패(없음 `[]`과 다르다). */
    readonly filings: readonly LargeHolderFiling[] | null;
}

function FilingRow({ filing }: { readonly filing: LargeHolderFiling }) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    const kind = largeHolderKind(filing.form);
    const href = toSafeHttpUrl(filing.url);
    return (
        <li className={cn(SURFACE_NESTED, 'p-3')}>
            <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="min-w-0 text-sm font-medium break-words text-secondary-100">
                    {filing.filer === ''
                        ? t('largeHolders.unknownFiler')
                        : filing.filer}
                </p>
                <span
                    className={cn(
                        'rounded px-1.5 py-0.5 text-xs font-medium',
                        KIND_CLASS[kind]
                    )}
                >
                    {kind === '13d'
                        ? t('largeHolders.kind13d')
                        : kind === '13g'
                          ? t('largeHolders.kind13g')
                          : t('largeHolders.kindOther')}
                </span>
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-4">
                <div>
                    <dt className="text-secondary-400">
                        {t('largeHolders.colDate')}
                    </dt>
                    <dd className="font-mono text-secondary-200 tabular-nums">
                        {filing.filingDate}
                    </dd>
                </div>
                <div>
                    <dt className="text-secondary-400">
                        {t('largeHolders.colForm')}
                    </dt>
                    <dd className="font-mono text-secondary-200">
                        {filing.form}
                    </dd>
                </div>
                <div>
                    <dt className="text-secondary-400">
                        {t('largeHolders.colPercent')}
                    </dt>
                    <dd className="font-mono text-secondary-200 tabular-nums">
                        {filing.percentOfClass === null
                            ? '–'
                            : formatPercent(filing.percentOfClass, locale, 2)}
                    </dd>
                </div>
                <div>
                    <dt className="text-secondary-400">
                        {t('largeHolders.colShares')}
                    </dt>
                    <dd className="text-secondary-200 tabular-nums">
                        {filing.shares === null
                            ? '–'
                            : formatCompact(filing.shares, locale)}
                    </dd>
                </div>
            </dl>
            {href !== null && (
                <div className="mt-2 text-right">
                    <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={LINK_CLASS}
                    >
                        {t('largeHolders.filing')}
                    </a>
                </div>
            )}
        </li>
    );
}

/**
 * 5% 이상 대량보유(13D·13G) 최근 공시 목록. 13D(행동주의·경영 참여 가능)와 13G(단순 투자)를 배지 글자로
 * 구분한다. 조회가 실패했으면(`null`) "불러오지 못했어요"라고, 공시가 없으면 "데이터 없음"이라고 갈라 말한다.
 * 카드 목록 하나로 모든 폭을 처리한다(가로 스크롤 표 없음).
 */
export function LargeHoldersSection({ filings }: LargeHoldersSectionProps) {
    const t = useTranslations('widgets.investor-flows');
    const rows = filings === null ? [] : buildLargeHolderRows(filings);
    return (
        <section
            aria-labelledby={HEADING_ID}
            className={cn(SURFACE_CARD, 'space-y-4 p-6')}
        >
            <div>
                <h2 id={HEADING_ID} className={HEADING_SECTION}>
                    {t('largeHolders.title')}
                    <FlowTooltip term="largeHolder13dg" />
                </h2>
                <p className="mt-1 text-xs text-secondary-400">
                    {t('largeHolders.subtitle')}
                </p>
            </div>
            {filings === null ? (
                <p className="text-sm text-secondary-300">
                    {t('largeHolders.unavailable')}
                </p>
            ) : rows.length === 0 ? (
                <p className="text-sm text-secondary-300">
                    {t('largeHolders.noData')}
                </p>
            ) : (
                <ul className="grid gap-2 md:grid-cols-2">
                    {rows.map(filing => (
                        <FilingRow
                            key={`${filing.filingDate}-${filing.filer}-${filing.form}-${filing.url}`}
                            filing={filing}
                        />
                    ))}
                </ul>
            )}
        </section>
    );
}
