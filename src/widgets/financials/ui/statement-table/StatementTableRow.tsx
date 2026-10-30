/**
 * 재무제표 표의 지표 한 행 — 행 머리글과 값 셀들.
 */
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import type { StatementCurrency } from '../../utils/statementCurrency';
import {
    cellToneClass,
    formatStatementValue,
} from '../../utils/statementFormat';
import type { StatementTableRowData } from '../../utils/statementTableTypes';

interface StatementTableRowProps {
    row: StatementTableRowData;
    columns: string[];
    currency: StatementCurrency;
}

/** 행 하나를 그린다. 셀 key는 컬럼 라벨이라 `statementColumnLabel`이 유일성을 보장한다. */
export function StatementTableRow({
    row,
    columns,
    currency,
}: StatementTableRowProps) {
    const locale = useResolvedLocale();
    const colorize = row.colorize !== false;
    return (
        <tr className="border-b border-secondary-700/50 transition-colors last:border-b-0 hover:bg-secondary-800/40">
            <th
                scope="row"
                className="py-2.5 pr-4 text-left text-xs font-normal whitespace-nowrap text-secondary-300"
            >
                {row.labelKo}
                {row.tooltip && <span className="ml-1">{row.tooltip}</span>}
            </th>
            {row.values.map((value, j) => (
                <td
                    key={columns[j]}
                    className={cn(
                        'px-3 py-2.5 text-right font-mono text-xs whitespace-nowrap tabular-nums',
                        cellToneClass(value, colorize)
                    )}
                >
                    {formatStatementValue(value, row.format, currency, locale)}
                </td>
            ))}
        </tr>
    );
}
