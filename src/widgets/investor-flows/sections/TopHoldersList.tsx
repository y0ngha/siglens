'use client';

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import type {
    InstitutionalHolderChange,
    InstitutionalHolderChangeKind,
} from '@y0ngha/siglens-core';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import { SURFACE_NESTED } from '@/shared/lib/surfaceStyles';
import { FlowTooltip } from '../investorFlowsTooltips';
import {
    formatCompact,
    formatSignedCompact,
    formatSignedPercent,
} from '../utils/flowFormat';
import {
    filterHolders,
    holderChangePercent,
    holderChangeShares,
    type HolderFilter,
} from '../utils/institutional';

const STATUS_KEY: Record<InstitutionalHolderChangeKind, string> = {
    new: 'new',
    increased: 'increased',
    decreased: 'decreased',
    exited: 'exited',
    unchanged: 'unchanged',
};

const STATUS_CLASS: Record<InstitutionalHolderChangeKind, string> = {
    new: 'bg-ui-success/10 text-ui-success-text',
    increased: 'bg-ui-success/10 text-ui-success-text',
    decreased: 'bg-ui-danger/10 text-ui-danger-text',
    exited: 'bg-ui-danger/10 text-ui-danger-text',
    unchanged: 'bg-secondary-700 text-secondary-300',
};

/** 색과 별개로 붙는 방향 기호. */
const STATUS_MARK: Record<InstitutionalHolderChangeKind, string> = {
    new: '+',
    increased: '▲',
    decreased: '▼',
    exited: '✕',
    unchanged: '=',
};

const FILTERS: readonly { value: HolderFilter; key: string }[] = [
    { value: 'all', key: 'all' },
    { value: 'new', key: 'new' },
    { value: 'exited', key: 'exited' },
];

function StatusBadge({
    change,
}: {
    readonly change: InstitutionalHolderChangeKind;
}) {
    const tStatus = useTranslations('widgets.investor-flows.status');
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium',
                STATUS_CLASS[change]
            )}
        >
            <span aria-hidden="true">{STATUS_MARK[change]}</span>
            {tStatus(STATUS_KEY[change])}
        </span>
    );
}

interface HolderChangeTextProps {
    readonly holder: InstitutionalHolderChange;
}

/** 변화 주식 수 + 변화율(직전 보유가 없으면 율은 생략). */
function HolderChangeText({ holder }: HolderChangeTextProps) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    if (holder.change === 'unchanged') return <>{t('holders.noChange')}</>;
    const shares = formatSignedCompact(holderChangeShares(holder), locale);
    const pct = holderChangePercent(holder);
    return (
        <>
            {shares}
            {pct !== null && (
                <span className="text-secondary-400">
                    {' '}
                    ({formatSignedPercent(pct, locale)})
                </span>
            )}
        </>
    );
}

interface TopHoldersListProps {
    readonly holders: readonly InstitutionalHolderChange[];
    /** 보유 현황의 기준 분기(`topHoldersPeriod`). 모르면 `null`. */
    readonly period: string | null;
}

/**
 * 상위 보유 기관 — 기관명·보유 주식·직전 분기 대비 변화(주식 수·%)·상태 배지(신규/증가/감소/청산/유지).
 * "전체 / 신규 진입 / 완전 청산" 필터로 신규·청산 목록만 볼 수 있다.
 *
 * 넓은 화면은 표, 좁은 화면은 카드 목록이다(가로 스크롤 표를 쓰지 않는다). 두 표현을 모두 렌더하고 CSS로
 * 가르는데, 보조기기에는 `hidden`인 쪽이 숨겨져 한 번만 읽힌다.
 */
export function TopHoldersList({ holders, period }: TopHoldersListProps) {
    const t = useTranslations('widgets.investor-flows');
    const tFilter = useTranslations('widgets.investor-flows.filter');
    const locale = useResolvedLocale();
    const [filter, setFilter] = useState<HolderFilter>('all');
    const groupId = useId();
    const visible = filterHolders(holders, filter);
    const counts: Record<HolderFilter, number> = {
        all: holders.length,
        new: filterHolders(holders, 'new').length,
        exited: filterHolders(holders, 'exited').length,
    };
    return (
        <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className={HEADING_SUBSECTION}>
                    {t('holders.title')}
                    <FlowTooltip term="institutionalHolding" />
                </h3>
                <div
                    role="group"
                    aria-labelledby={`${groupId}-label`}
                    className="flex gap-1"
                >
                    <span id={`${groupId}-label`} className="sr-only">
                        {t('holders.filterLabel')}
                    </span>
                    {FILTERS.map(item => (
                        <button
                            key={item.value}
                            type="button"
                            aria-pressed={filter === item.value}
                            onClick={() => setFilter(item.value)}
                            className={cn(
                                'tap-target rounded border px-2.5 py-1 text-xs font-medium focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none',
                                filter === item.value
                                    ? 'border-primary-500 bg-primary-500/10 text-primary-400'
                                    : 'border-border-control text-secondary-300 hover:border-primary-500'
                            )}
                        >
                            {tFilter(item.key, { count: counts[item.value] })}
                        </button>
                    ))}
                </div>
            </div>
            {period !== null && (
                <p className="mb-2 text-xs text-secondary-400">
                    {t('holders.basis', { period })}
                </p>
            )}
            {visible.length === 0 ? (
                <p className="text-sm text-secondary-400">
                    {t('holders.emptyFiltered')}
                </p>
            ) : (
                <>
                    <ul className="space-y-2 md:hidden">
                        {visible.map(holder => (
                            <li
                                key={`${holder.cik}-${holder.change}`}
                                className={cn(SURFACE_NESTED, 'p-3')}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <p className="min-w-0 text-sm font-medium break-words text-secondary-100">
                                        {holder.filerName}
                                    </p>
                                    <StatusBadge change={holder.change} />
                                </div>
                                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                                    <dt className="text-secondary-400">
                                        {t('holders.colShares')}
                                    </dt>
                                    <dd className="text-right text-secondary-200 tabular-nums">
                                        {formatCompact(holder.shares, locale)}
                                    </dd>
                                    <dt className="text-secondary-400">
                                        {t('holders.colChange')}
                                    </dt>
                                    <dd className="text-right text-secondary-200 tabular-nums">
                                        <HolderChangeText holder={holder} />
                                    </dd>
                                </dl>
                            </li>
                        ))}
                    </ul>
                    <div className="hidden md:block">
                        <table className="w-full text-sm">
                            <caption className="sr-only">
                                {t('holders.title')}
                            </caption>
                            <thead>
                                <tr className="border-b border-secondary-700 text-xs text-secondary-400">
                                    <th
                                        scope="col"
                                        className="py-2 pr-3 text-left font-medium"
                                    >
                                        {t('holders.colName')}
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-3 py-2 text-right font-medium"
                                    >
                                        {t('holders.colShares')}
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-3 py-2 text-right font-medium"
                                    >
                                        {t('holders.colChange')}
                                    </th>
                                    <th
                                        scope="col"
                                        className="py-2 pl-3 text-left font-medium"
                                    >
                                        {t('holders.colStatus')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {visible.map(holder => (
                                    <tr
                                        key={`${holder.cik}-${holder.change}`}
                                        className="border-b border-secondary-700 last:border-b-0"
                                    >
                                        <th
                                            scope="row"
                                            className="max-w-xs py-2.5 pr-3 text-left font-medium break-words text-secondary-100"
                                        >
                                            {holder.filerName}
                                        </th>
                                        <td className="px-3 py-2.5 text-right tabular-nums">
                                            {formatCompact(
                                                holder.shares,
                                                locale
                                            )}
                                        </td>
                                        <td className="px-3 py-2.5 text-right tabular-nums">
                                            <HolderChangeText holder={holder} />
                                        </td>
                                        <td className="py-2.5 pl-3">
                                            <StatusBadge
                                                change={holder.change}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}
