'use client';

import type { ChatTrendTableModel } from '@/widgets/chart/visual/reusedBlockTypes';
import { VisualBlockCard } from '@/widgets/chart/visual/VisualBlockCard';
import { FinancialTrendChart } from '@/widgets/financials/sections/FinancialTrendChart';
import { StatementTable } from '@/widgets/financials/sections/StatementTable';

/**
 * 기간별 추이 블록(실적·배당) — 펀더멘털 탭과 같은 막대 추세 차트 아래에 같은 재무제표 표를 둔다. 차트의 SVG는
 * 보조기기에서 숨겨져 있어 요약 `aria-label`을 `role="img"` 래퍼에 달고, 정확한 값은 표(캡션 있음)에서 읽는다.
 */
export function TrendTableBlock({
    model,
}: {
    readonly model: ChatTrendTableModel;
}) {
    return (
        <VisualBlockCard title={model.title} asOfText={model.asOfText}>
            <div role="img" aria-label={model.ariaLabel} className="mb-4">
                <FinancialTrendChart
                    series={model.series}
                    periods={model.columns}
                    currency={model.currency}
                />
            </div>
            <StatementTable
                caption={model.title}
                columns={model.columns}
                rows={model.rows}
                currency={model.currency}
            />
        </VisualBlockCard>
    );
}
