import type { BacktestCase } from '@y0ngha/siglens-core';
import { BacktestCaseCard } from './BacktestCaseCard';
import {
    DatasetEmptyMessage,
    FilteredEmptyMessage,
} from './ui/case-list/EmptyMessages';
import { MonthSection } from './ui/case-list/MonthSection';
import { cardAttrs, UNFILTERED_TOKEN } from './utils/caseListVisibility';
import { groupCasesByMonth } from './utils/groupCasesByMonth';

interface BacktestCaseListProps {
    cases: BacktestCase[];
}

/** 기본으로 펼쳐 두는 최신 월 개수. 나머지는 요약 줄만 보이고 눌러서 연다. */
const OPEN_RECENT_MONTHS = 3;

/**
 * 월별 접이식 케이스 목록 — **최신 월이 위**다.
 *
 * 월마다 네이티브 `<details>`로 접고 최신 3개월만 펼친다. 접힌 월의 카드도 DOM에는 그대로
 * 있다 — 크롤러는 접힌 `<details>` 안의 텍스트도 읽으므로 색인 범위가 줄지 않는다.
 *
 * **서버 컴포넌트로 한 번만 렌더된다.** 종목 탭은 목록을 다시 그리지 않고 요소마다 붙은
 * 표기(`caseListVisibility`)로 보이는 범위만 고른다 — 종목을 고르면 그 종목 카드와 그
 * 종목이 있는 월만 남기고, 월은 전부 펼치며, 월 건수도 그 종목 기준 표시로 바꾼다.
 * 고른 종목에 카드가 없으면 숨겨 둔 안내 문구가 드러난다.
 */
export function BacktestCaseList({ cases }: BacktestCaseListProps) {
    if (cases.length === 0) return <DatasetEmptyMessage />;

    return (
        <div className="page-container flex flex-col gap-2 pb-6">
            <FilteredEmptyMessage />
            {groupCasesByMonth(cases).map((group, index) => (
                <MonthSection
                    key={group.key}
                    group={group}
                    defaultOpen={index < OPEN_RECENT_MONTHS}
                >
                    {group.items.map(c => (
                        <div
                            key={`${c.ticker}-${c.entryDate}`}
                            {...cardAttrs([UNFILTERED_TOKEN, c.ticker])}
                        >
                            <BacktestCaseCard case_={c} />
                        </div>
                    ))}
                </MonthSection>
            ))}
        </div>
    );
}
