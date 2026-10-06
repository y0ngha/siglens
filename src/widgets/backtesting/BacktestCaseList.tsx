import { useTranslations } from 'next-intl';
import type { BacktestCase } from '@y0ngha/siglens-core';
import { BacktestCaseCard } from './BacktestCaseCard';
import { UNFILTERED_TOKEN, visibilityAttrs } from './lib/caseListVisibility';

interface BacktestCaseListProps {
    cases: BacktestCase[];
}

/** 기본으로 펼쳐 두는 최신 월 개수. 나머지는 요약 줄만 보이고 눌러서 연다. */
const OPEN_RECENT_MONTHS = 3;

/**
 * `YYYY-MM`에서 표시용 연·월 조각을 뽑는다. 문장 조립은 번역자를 선언한
 * 컴포넌트가 한다 — 이 헬퍼가 `t('리터럴')`을 부르면 추출기가 파일을
 * 통째로 건너뛴다(§noTranslatorParamCall.test.ts).
 */
function monthParts(dateStr: string): { year: string; month: number } {
    const [year, month] = dateStr.split('-');
    return { year: year ?? '', month: parseInt(month ?? '1', 10) };
}

interface MonthGroup {
    /** `YYYY-MM` — 그룹 식별자이자 React key. */
    key: string;
    label: string;
    items: BacktestCase[];
    /** 이 월에 케이스가 있는 종목별 건수(첫 등장 순). 종목 탭의 월 건수 표시에 쓴다. */
    countByTicker: ReadonlyMap<string, number>;
}

function countByTicker(items: readonly BacktestCase[]): Map<string, number> {
    return items.reduce(
        (acc, c) => acc.set(c.ticker, (acc.get(c.ticker) ?? 0) + 1),
        new Map<string, number>()
    );
}

/**
 * 월별 접이식 케이스 목록 — **최신 월이 위**다.
 *
 * 예전에는 100건·17개월을 오래된 순으로 전부 펼쳐 놓아서, 사용자가 가장 궁금한 최근
 * 결과까지 한참 내려가야 했다. 지금은 월마다 네이티브 `<details>`로 접고 최신 3개월만
 * 펼친다. 접힌 월의 카드도 DOM에는 그대로 있다 — 크롤러는 접힌 `<details>` 안의 텍스트도
 * 읽으므로 색인 범위가 줄지 않는다.
 *
 * **서버 컴포넌트로 한 번만 렌더된다.** 종목 탭은 목록을 다시 그리지 않고 요소마다 붙은
 * 표기(`caseListVisibility`)로 보이는 범위만 고른다 — 종목을 고르면 그 종목 카드와 그
 * 종목이 있는 월만 남기고, 월은 전부 펼치며, 월 건수도 그 종목 기준 표시로 바꾼다.
 */
export function BacktestCaseList({ cases }: BacktestCaseListProps) {
    const t = useTranslations('widgets.backtesting');
    const tMisc = useTranslations('shared.ui.misc');
    if (cases.length === 0) {
        return (
            <p className="py-10 text-center text-sm text-secondary-500">
                {t('BacktestCaseList.9018e2')}
            </p>
        );
    }

    // 최신순. 같은 진입일끼리는 입력 순서를 지킨다(`toSorted`는 안정 정렬).
    const newestFirst = cases.toSorted((a, b) =>
        b.entryDate.localeCompare(a.entryDate)
    );

    // 월 키로 묶는다. `newestFirst`가 이미 정렬돼 있고 `Map`은 삽입 순서를 지키므로
    // 그룹 순서는 최신 월 → 오래된 월이다. 기존 배열을 변형하지 않고 새 배열로 이어 붙인다.
    const byMonth = newestFirst.reduce((acc, c) => {
        const key = c.entryDate.slice(0, 7);
        return acc.set(key, [...(acc.get(key) ?? []), c]);
    }, new Map<string, BacktestCase[]>());
    const groups: MonthGroup[] = [...byMonth].map(([key, items]) => {
        const { year, month } = monthParts(`${key}-01`);
        return {
            key,
            label: tMisc('backtestMonth', { v0: year, v1: month }),
            items,
            countByTicker: countByTicker(items),
        };
    });

    return (
        <div className="page-container flex flex-col gap-2 pb-6">
            {groups.map((group, index) => (
                <details
                    key={group.key}
                    open={index < OPEN_RECENT_MONTHS}
                    {...visibilityAttrs([
                        UNFILTERED_TOKEN,
                        ...group.countByTicker.keys(),
                    ])}
                    className="group"
                >
                    {/* `<summary>` 안에 헤딩을 둔다(HTML이 허용하는 구성). 접힌 상태에서도
                        헤딩 탐색으로 월을 건너뛸 수 있다 — 41,000자 페이지에 h1 하나뿐이라
                        스크린리더가 100개 케이스를 훑을 길이 없던 문제(SC 1.3.1)는 그대로
                        막는다. 기본 삼각형 마커는 지우고 같은 뜻의 셰브런을 직접 그린다. */}
                    <summary className="flex cursor-pointer list-none items-center gap-2 rounded pt-3 pb-1 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                        <svg
                            aria-hidden="true"
                            viewBox="0 0 10 10"
                            className="h-2.5 w-2.5 shrink-0 fill-none stroke-secondary-400 transition-transform group-open:rotate-90 motion-reduce:transition-none"
                            strokeWidth={1.5}
                        >
                            <path d="M3.5 2 6.5 5 3.5 8" />
                        </svg>
                        <h2 className="text-sm font-semibold text-secondary-300">
                            {group.label}
                        </h2>
                        {/* 건수는 탭마다 다르다 — "전체"는 월 합계, 종목 탭은 그 종목 건수.
                            종목별 표시는 서버 HTML에서 숨겨 두고 탭이 바꿔 보인다. */}
                        <span
                            {...visibilityAttrs([UNFILTERED_TOKEN])}
                            className="text-xs text-secondary-400 tabular-nums"
                        >
                            {t('BacktestCaseList.caseCount', {
                                v0: group.items.length,
                            })}
                        </span>
                        {[...group.countByTicker].map(([ticker, count]) => (
                            <span
                                key={ticker}
                                hidden
                                {...visibilityAttrs([ticker])}
                                className="text-xs text-secondary-400 tabular-nums"
                            >
                                {t('BacktestCaseList.caseCount', { v0: count })}
                            </span>
                        ))}
                    </summary>
                    <div className="flex flex-col gap-2 pt-1">
                        {group.items.map(c => (
                            <div
                                key={`${c.ticker}-${c.entryDate}`}
                                {...visibilityAttrs([
                                    UNFILTERED_TOKEN,
                                    c.ticker,
                                ])}
                            >
                                <BacktestCaseCard case_={c} />
                            </div>
                        ))}
                    </div>
                </details>
            ))}
        </div>
    );
}
