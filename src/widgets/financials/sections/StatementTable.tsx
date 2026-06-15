import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

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
}

interface StatementTableProps {
    caption?: string;
    /**
     * Year/period labels — oldest first (left-to-right display order).
     */
    columns: string[];
    rows: TableRow[];
}

/** Compact USD formatter: $1.2B, $340M, $5K */
const usdFormatter = new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
    style: 'currency',
    currency: 'USD',
});

/** Format a financial value based on its type. Returns '—' for null. */
function formatValue(value: number | null, format: FormatType = 'num'): string {
    if (value === null) return '—';

    switch (format) {
        case 'usd':
            return usdFormatter.format(value);
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
}: StatementTableProps) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                {caption && (
                    <caption className="text-secondary-400 mb-2 text-left text-xs tracking-widest uppercase">
                        {caption}
                    </caption>
                )}
                <thead>
                    <tr className="text-secondary-400 border-secondary-700 border-b text-xs tracking-widest uppercase">
                        <th className="pb-2 text-left font-medium">지표</th>
                        {columns.map(col => (
                            <th
                                key={col}
                                className="pb-2 text-right font-medium"
                            >
                                {col}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr
                            key={i}
                            className="hover:bg-secondary-800/40 border-secondary-700/50 border-b transition-colors last:border-b-0"
                        >
                            <td className="text-secondary-300 py-2.5 pr-4 text-xs font-medium whitespace-nowrap">
                                {row.labelKo}
                                {row.tooltip && (
                                    <span className="ml-1">{row.tooltip}</span>
                                )}
                            </td>
                            {row.values.map((v, j) => {
                                const formatted = formatValue(v, row.format);
                                const isNegative = v !== null && v < 0;
                                const isPositive = v !== null && v > 0;

                                return (
                                    <td
                                        key={j}
                                        className={cn(
                                            'py-2.5 text-right font-mono text-xs tabular-nums',
                                            formatted === '—'
                                                ? 'text-secondary-500'
                                                : isNegative
                                                  ? 'text-chart-bearish'
                                                  : isPositive
                                                    ? ''
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
    );
}
