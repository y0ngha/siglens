import { useTranslations } from 'next-intl';
import type {
    InsiderTransaction,
    InvestorFlowsWindow,
} from '@y0ngha/siglens-core';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import { toSafeHttpUrl } from '@/shared/lib/safeUrl';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import { SURFACE_NESTED } from '@/shared/lib/surfaceStyles';
import {
    formatCompact,
    formatInteger,
    formatUsdCompact,
} from '../utils/flowFormat';
import { shortRole, type InsiderTableData } from '../utils/insider';

const LINK_CLASS =
    'tap-target rounded text-xs text-primary-400 underline transition-colors hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

function TypeBadge({ type }: { readonly type: InsiderTransaction['type'] }) {
    const t = useTranslations('widgets.investor-flows');
    const isBuy = type === 'buy';
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium',
                isBuy
                    ? 'bg-ui-success/10 text-ui-success-text'
                    : 'bg-ui-danger/10 text-ui-danger-text'
            )}
        >
            <span aria-hidden="true">{isBuy ? '▲' : '▼'}</span>
            {isBuy ? t('insider.buy') : t('insider.sell')}
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
            {t('insider.filing')}
        </a>
    );
}

function rowKey(tx: InsiderTransaction): string {
    return `${tx.date}-${tx.name}-${tx.shares}-${tx.url}`;
}

interface TradeRowsProps {
    readonly rows: readonly InsiderTransaction[];
    /** 표 캡션(스크린 리더) — 묶음마다 다르다. */
    readonly caption: string;
}

/** 거래 묶음 하나 — 좁은 화면은 카드, 넓은 화면은 표. */
function TradeRows({ rows, caption }: TradeRowsProps) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    const value = (tx: InsiderTransaction): string =>
        tx.value === null ? '–' : formatUsdCompact(tx.value, locale);
    return (
        <>
            <ul className="space-y-2 md:hidden">
                {rows.map(tx => (
                    <li key={rowKey(tx)} className={cn(SURFACE_NESTED, 'p-3')}>
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
                        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                            <dt className="text-secondary-400">
                                {t('insider.colDate')}
                            </dt>
                            <dd className="text-right font-mono text-secondary-200 tabular-nums">
                                {tx.date}
                            </dd>
                            <dt className="text-secondary-400">
                                {t('insider.colShares')}
                            </dt>
                            <dd className="text-right text-secondary-200 tabular-nums">
                                {formatCompact(tx.shares, locale)}
                            </dd>
                            <dt className="text-secondary-400">
                                {t('insider.colValue')}
                            </dt>
                            <dd className="text-right text-secondary-200 tabular-nums">
                                {value(tx)}
                            </dd>
                        </dl>
                        <div className="mt-2 text-right">
                            <FilingLink url={tx.url} />
                        </div>
                    </li>
                ))}
            </ul>
            <div className="hidden md:block">
                <table className="w-full text-sm">
                    <caption className="sr-only">{caption}</caption>
                    <thead>
                        <tr className="border-b border-secondary-700 text-xs text-secondary-400">
                            <th
                                scope="col"
                                className="py-2 pr-3 text-left font-medium"
                            >
                                {t('insider.colDate')}
                            </th>
                            <th
                                scope="col"
                                className="px-3 py-2 text-left font-medium"
                            >
                                {t('insider.colName')}
                            </th>
                            <th
                                scope="col"
                                className="px-3 py-2 text-left font-medium"
                            >
                                {t('insider.colType')}
                            </th>
                            <th
                                scope="col"
                                className="px-3 py-2 text-right font-medium"
                            >
                                {t('insider.colShares')}
                            </th>
                            <th
                                scope="col"
                                className="px-3 py-2 text-right font-medium"
                            >
                                {t('insider.colValue')}
                            </th>
                            <th
                                scope="col"
                                className="py-2 pl-3 text-right font-medium"
                            >
                                {t('insider.colFiling')}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(tx => (
                            <tr
                                key={rowKey(tx)}
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
                                <td className="py-2.5 pl-3 text-right">
                                    <FilingLink url={tx.url} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    );
}

interface InsiderTradeListProps {
    readonly table: InsiderTableData;
    /** 점수 창 — 창 밖 묶음의 제목에 시작일을 적는다. 모르면 묶음을 나누지 않는다(`buildInsiderTable`). */
    readonly scoringWindow: InvestorFlowsWindow | null;
}

/**
 * 내부자 매수·매도 거래 목록. 좁은 화면은 카드, 넓은 화면은 표(가로 스크롤 없음). 날짜는 ASCII라 mono,
 * 금액·주식 수는 로케일 축약(한글 포함)이라 `tabular-nums`만 쓴다(`DESIGN.md` 문구 규약).
 *
 * 점수 창 밖의 거래는 "집계 기간 밖" 묶음으로 따로 그린다 — 위 요약 카드의 건수·금액은 창 안 거래만 센 값이라, 섞어 두면 창 밖의
 * 매수가 "매수 0건" 아래에 보인다.
 */
export function InsiderTradeList({
    table,
    scoringWindow,
}: InsiderTradeListProps) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    const hasOutside = table.outsideWindowRows.length > 0;
    const emptyText =
        hasOutside && scoringWindow !== null
            ? t('insider.noTradesInWindow', {
                  days: formatInteger(scoringWindow.days, locale),
              })
            : t('insider.noTrades');
    return (
        <div>
            <h3 className={cn('mb-2', HEADING_SUBSECTION)}>
                {t('insider.tableTitle')}
            </h3>
            {table.rows.length === 0 ? (
                <p className="text-sm text-secondary-300">{emptyText}</p>
            ) : (
                <TradeRows
                    rows={table.rows}
                    caption={t('insider.tableTitle')}
                />
            )}
            {hasOutside &&
                scoringWindow !== null &&
                scoringWindow.from !== null && (
                    <div className="mt-4">
                        <h4 className="text-sm font-medium text-secondary-200">
                            {t('insider.outsideWindowTitle', {
                                from: scoringWindow.from,
                            })}
                        </h4>
                        <p className="mt-1 mb-2 text-xs text-secondary-400">
                            {t('insider.outsideWindowNote')}
                        </p>
                        <TradeRows
                            rows={table.outsideWindowRows}
                            caption={t('insider.outsideWindowTitle', {
                                from: scoringWindow.from,
                            })}
                        />
                    </div>
                )}
            {table.omittedOtherCount > 0 && (
                <p className="mt-2 text-xs text-secondary-400">
                    {t('insider.omittedOther', {
                        count: formatInteger(table.omittedOtherCount, locale),
                    })}
                </p>
            )}
        </div>
    );
}
