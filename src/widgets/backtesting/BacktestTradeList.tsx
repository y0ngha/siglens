import type { BacktestTradeRowModel } from '@/entities/backtest-case/model';
import { cn } from '@/shared/lib/cn';
import { BacktestTradeRow } from './BacktestTradeRow';
import { TradeDetailsHost } from './TradeDetailsHost';
import {
    DatasetEmptyMessage,
    FilteredEmptyMessage,
} from './ui/case-list/EmptyMessages';
import { MonthSection } from './ui/case-list/MonthSection';
import { cardAttrs, UNFILTERED_TOKEN } from './utils/caseListVisibility';
import { groupCasesByMonth } from './utils/groupCasesByMonth';

interface BacktestTradeListProps {
    runId: string;
    rows: readonly BacktestTradeRowModel[];
}

const OPEN_RECENT_MONTHS = 3;

/**
 * 매매 행(`BacktestTradeRow`) 스타일을 여기서 한 번만 정의한다. 행마다 같은 클래스 문자열을
 * 반복하면 690행 × 600바이트가 HTML과 RSC 페이로드에 두 번씩 실린다. 선택자는 `data-trade-row`
 * 아래로 한정해 월 섹션의 `<summary>`와 섞이지 않는다.
 */
const TRADE_ROW_STYLES = cn(
    '[&_[data-trade-row]>summary]:flex [&_[data-trade-row]>summary]:cursor-pointer [&_[data-trade-row]>summary]:list-none',
    '[&_[data-trade-row]>summary]:flex-wrap [&_[data-trade-row]>summary]:items-center [&_[data-trade-row]>summary]:gap-x-3 [&_[data-trade-row]>summary]:gap-y-1',
    '[&_[data-trade-row]>summary]:rounded [&_[data-trade-row]>summary]:px-3 [&_[data-trade-row]>summary]:py-2 [&_[data-trade-row]>summary]:text-xs',
    '[&_[data-trade-row]>summary]:focus-visible:ring-2 [&_[data-trade-row]>summary]:focus-visible:ring-primary-500 [&_[data-trade-row]>summary]:focus-visible:outline-none',
    '[&_[data-trade-row]>summary::-webkit-details-marker]:hidden',
    '[&_[data-col=ticker]]:w-12 [&_[data-col=ticker]]:shrink-0 [&_[data-col=ticker]]:font-bold [&_[data-col=ticker]]:text-secondary-100',
    '[&_[data-col=entry]]:shrink-0 [&_[data-col=entry]]:rounded [&_[data-col=entry]]:bg-secondary-700/60 [&_[data-col=entry]]:px-1.5 [&_[data-col=entry]]:py-0.5 [&_[data-col=entry]]:text-secondary-300',
    '[&_[data-col=period]]:text-secondary-400 [&_[data-col=period]]:tabular-nums',
    '[&_[data-col=path]]:text-secondary-500',
    '[&_[data-col=return]]:ml-auto [&_[data-col=return]]:font-mono [&_[data-col=return]]:text-sm [&_[data-col=return]]:font-bold [&_[data-col=return]]:tabular-nums',
    '[&_[data-sign=pos]]:text-ui-success-text [&_[data-sign=neg]]:text-ui-danger-text'
);

/**
 * 매수일 기준 월별 매매 목록(최신 월부터). 종목 필터는 서버 HTML에 모든 행을 그려 두고
 * `BacktestTabs`가 가시성 속성만 바꾼다. 펼친 상세는 `TradeDetailsHost`가 필요할 때 그린다.
 */
export function BacktestTradeList({ runId, rows }: BacktestTradeListProps) {
    if (rows.length === 0) return <DatasetEmptyMessage />;

    return (
        <TradeDetailsHost runId={runId}>
            <div
                className={cn(
                    'page-container flex flex-col gap-2 pb-6',
                    TRADE_ROW_STYLES
                )}
            >
                <FilteredEmptyMessage />
                {groupCasesByMonth(rows).map((group, index) => (
                    <MonthSection
                        key={group.key}
                        group={group}
                        defaultOpen={index < OPEN_RECENT_MONTHS}
                    >
                        {group.items.map(row => (
                            <div
                                key={row.key}
                                {...cardAttrs([UNFILTERED_TOKEN, row.ticker])}
                            >
                                <BacktestTradeRow row={row} />
                            </div>
                        ))}
                    </MonthSection>
                ))}
            </div>
        </TradeDetailsHost>
    );
}
