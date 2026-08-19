import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import {
    formatCurrencyCompact,
    DEFAULT_STATEMENT_CURRENCY,
    type StatementCurrency,
} from '../utils/numberFormat';

type FormatType = 'usd' | 'pct' | 'num';

interface TableRow {
    labelKo: string;
    tooltip?: ReactNode;
    /**
     * Values aligned to the `columns` array. Index 0 corresponds to `columns[0]`.
     * Rows are expected to be passed oldest→newest (left-to-right display order).
     */
    values: (number | null)[];
    format?: FormatType;
    /**
     * When true (default), positive values render `text-ui-success-text` and negative
     * values render `text-ui-danger-text` — appropriate for income/margin/growth rows
     * where positive genuinely means good and negative means bad.
     *
     * Set to false for absolute balance-sheet magnitudes (e.g. 총자산, 총부채,
     * 자본, 현금) where a larger number is neither inherently good nor bad.
     * These rows render neutral `text-secondary-300` regardless of sign.
     */
    colorize?: boolean;
}

interface StatementTableProps {
    caption?: string;
    /**
     * Year/period labels — oldest first (left-to-right display order).
     */
    columns: string[];
    rows: TableRow[];
    /** 금액 축(`format: 'usd'`)에 적용할 통화. 생략하면 USD — 미국 종목의 기존 동작. */
    currency?: StatementCurrency;
}

/** Format a financial value based on its type. Returns '—' for null. */
function formatValue(
    value: number | null,
    format: FormatType = 'num',
    currency: StatementCurrency = DEFAULT_STATEMENT_CURRENCY
): string {
    if (value === null) return '—';

    switch (format) {
        // 'usd'는 "금액" 축을 뜻하는 레거시 라벨이다 — 실제 통화는 `currency`가 정한다.
        case 'usd':
            return formatCurrencyCompact(value, currency);
        case 'pct':
            return `${value.toFixed(1)}%`;
        case 'num':
            return value.toFixed(2);
    }
}

/**
 * Reusable financial statement table (RSC-safe, no chart library).
 *
 * Columns represent fiscal years/periods (oldest→newest, left-to-right).
 * Rows represent financial metrics with formatted values.
 * Null values render as em-dash (—).
 */
export function StatementTable({
    caption,
    columns,
    rows,
    currency = DEFAULT_STATEMENT_CURRENCY,
}: StatementTableProps) {
    const t = useTranslations('widgets.financials');
    return (
        <>
            <p className="mb-2 text-xs text-secondary-400 sm:hidden">
                {t('StatementTable.b488b1')}
            </p>
            <div
                className="overflow-x-auto rounded-xl focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                role="region"
                aria-label={
                    caption
                        ? `${caption} (좌우 스크롤 가능)`
                        : t('StatementTable.99a09e')
                }
                tabIndex={0}
            >
                <table className="w-full text-sm">
                    {caption && (
                        <caption className="mb-2 text-left text-xs tracking-widest text-secondary-400 uppercase">
                            {caption}
                        </caption>
                    )}
                    <thead>
                        <tr className="border-b border-secondary-700 text-xs tracking-widest text-secondary-400 uppercase">
                            <th
                                scope="col"
                                className="pb-2 text-left font-medium"
                            >
                                {t('StatementTable.0b5a2c')}
                            </th>
                            {columns.map(col => (
                                <th
                                    key={col}
                                    scope="col"
                                    className="px-3 pb-2 text-right font-medium whitespace-nowrap"
                                >
                                    {col}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(row => (
                            <tr
                                key={row.labelKo}
                                className="border-b border-secondary-700/50 transition-colors last:border-b-0 hover:bg-secondary-800/40"
                            >
                                <th
                                    scope="row"
                                    className="py-2.5 pr-4 text-left text-xs font-normal whitespace-nowrap text-secondary-300"
                                >
                                    {row.labelKo}
                                    {row.tooltip && (
                                        <span className="ml-1">
                                            {row.tooltip}
                                        </span>
                                    )}
                                </th>
                                {row.values.map((v, j) => {
                                    const formatted = formatValue(
                                        v,
                                        row.format,
                                        currency
                                    );
                                    const shouldColorize =
                                        row.colorize !== false;
                                    const isNegative = v !== null && v < 0;
                                    const isPositive = v !== null && v > 0;

                                    return (
                                        <td
                                            key={columns[j]}
                                            className={cn(
                                                'px-3 py-2.5 text-right font-mono text-xs whitespace-nowrap tabular-nums',
                                                formatted === '—'
                                                    ? 'text-secondary-400'
                                                    : !shouldColorize
                                                      ? 'text-secondary-300'
                                                      : isNegative
                                                        ? 'text-ui-danger-text'
                                                        : isPositive
                                                          ? 'text-ui-success-text'
                                                          : ''
                                            )}
                                        >
                                            {formatted}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    );
}
