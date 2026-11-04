import type { BacktestTradeRowModel } from '@/entities/backtest-case/model';
import { cn } from '@/shared/lib/cn';
import { BacktestTradeRows } from './BacktestTradeRows';
import { TradeDetailsHost } from './TradeDetailsHost';
import {
    DatasetEmptyMessage,
    FilteredEmptyMessage,
} from './ui/case-list/EmptyMessages';
import { MonthSection } from './ui/case-list/MonthSection';
import { cardAttrs, UNFILTERED_TOKEN } from './utils/caseListVisibility';
import {
    type CaseMonthGroup,
    groupCasesByMonth,
} from './utils/groupCasesByMonth';
import { LAZY_MONTH_ATTR } from './utils/tradeDetailsToggle';

interface BacktestTradeListProps {
    runId: string;
    rows: readonly BacktestTradeRowModel[];
}

/**
 * 처음부터 펼쳐 두고 서버 HTML에 행까지 그리는 최근 월 수. 나머지 월은 접힌 머리줄만 서버가
 * 그리고, 행은 펼칠 때 `TradeDetailsHost`가 공개 정적 파일에서 불러와 그린다 — 690행을 모두
 * 서버에서 그리면 HTML과 그 안의 RSC 페이로드에 행이 두 번씩 실려 페이지가 1.2MB였다.
 */
const OPEN_RECENT_MONTHS = 3;

/**
 * 행을 나중에 그릴 월의 자리. 그 달에 매매가 있는 종목 토큰과 행 표식을 달아 둔다 — 종목 탭에서
 * 행이 아직 없을 때도 "선택한 종목에 매매 없음" 안내가 잘못 드러나지 않는다.
 */
function LazyMonthSlot({ group }: { group: CaseMonthGroup }) {
    return (
        <div
            {...cardAttrs([UNFILTERED_TOKEN, ...group.countByTicker.keys()])}
            {...{ [LAZY_MONTH_ATTR]: group.key }}
            className="flex flex-col gap-2"
        />
    );
}

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
 * 매수일 기준 월별 매매 목록(최신 월부터). 종목 필터는 `BacktestTabs`가 가시성 속성만 바꾼다.
 * 최근 월의 행만 서버가 그리고, 나머지 월의 행과 펼친 상세는 `TradeDetailsHost`가 필요할 때 그린다.
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
                        {index < OPEN_RECENT_MONTHS ? (
                            <BacktestTradeRows rows={group.items} />
                        ) : (
                            <LazyMonthSlot group={group} />
                        )}
                    </MonthSection>
                ))}
            </div>
        </TradeDetailsHost>
    );
}
