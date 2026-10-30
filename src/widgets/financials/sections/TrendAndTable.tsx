/**
 * 손익계산서·재무상태표·현금흐름표가 공유하는 본문 — 추세 차트 아래에 값 표를 둔다.
 */
import { FinancialTrendChart } from './FinancialTrendChart';
import { StatementTable } from './StatementTable';
import type { StatementCurrency } from '../utils/statementCurrency';
import type { StatementTableRowData } from '../utils/statementTableTypes';
import type { TrendSeries } from '../utils/trendChartTypes';

interface TrendAndTableProps {
    caption: string;
    columns: string[];
    series: TrendSeries[];
    rows: StatementTableRowData[];
    currency: StatementCurrency;
}

/** 차트(시각)와 표(접근 가능한 수치 출처)가 같은 컬럼·통화를 쓰도록 한 곳에서 잇는다. */
export function TrendAndTable({
    caption,
    columns,
    series,
    rows,
    currency,
}: TrendAndTableProps) {
    return (
        <>
            <div className="mb-6">
                <FinancialTrendChart
                    series={series}
                    periods={columns}
                    currency={currency}
                />
            </div>
            <StatementTable
                caption={caption}
                columns={columns}
                rows={rows}
                currency={currency}
            />
        </>
    );
}
