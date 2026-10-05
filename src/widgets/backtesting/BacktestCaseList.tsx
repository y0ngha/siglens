import { useTranslations } from 'next-intl';
import type { BacktestCase } from '@y0ngha/siglens-core';
import { BacktestCaseCard } from './BacktestCaseCard';

interface BacktestCaseListProps {
    cases: BacktestCase[];
    /**
     * 모든 월을 펼칠지. 종목 필터가 걸려 있으면 그 종목의 케이스가 몇 건 안 되고
     * 사용자가 이미 좁혀서 보고 있으므로 접어 둘 이유가 없다.
     */
    openAll?: boolean;
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
}

/**
 * 월별 접이식 케이스 목록 — **최신 월이 위**다.
 *
 * 예전에는 100건·17개월을 오래된 순으로 전부 펼쳐 놓아서, 사용자가 가장 궁금한 최근
 * 결과까지 한참 내려가야 했다. 지금은 월마다 네이티브 `<details>`로 접고 최신 3개월만
 * 펼친다(`openAll`이면 전부). 접힌 월의 카드도 DOM에는 그대로 있다 — 크롤러는 접힌
 * `<details>` 안의 텍스트도 읽으므로 색인 범위가 줄지 않는다.
 */
export function BacktestCaseList({
    cases,
    openAll = false,
}: BacktestCaseListProps) {
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

    // 케이스마다 배열을 복제하지 않고 마지막 그룹에 밀어 넣는다(O(n)).
    const groups: MonthGroup[] = [];
    for (const c of newestFirst) {
        const key = c.entryDate.slice(0, 7);
        const last = groups[groups.length - 1];
        if (!last || last.key !== key) {
            const { year, month } = monthParts(c.entryDate);
            groups.push({
                key,
                label: tMisc('backtestMonth', { v0: year, v1: month }),
                items: [c],
            });
        } else {
            last.items.push(c);
        }
    }

    return (
        <div className="page-container flex flex-col gap-2 pb-6">
            {groups.map((group, index) => (
                <details
                    key={group.key}
                    open={openAll || index < OPEN_RECENT_MONTHS}
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
                        <span className="text-xs text-secondary-400 tabular-nums">
                            {t('BacktestCaseList.caseCount', {
                                v0: group.items.length,
                            })}
                        </span>
                    </summary>
                    <div className="flex flex-col gap-2 pt-1">
                        {group.items.map(c => (
                            <BacktestCaseCard
                                key={`${c.ticker}-${c.entryDate}`}
                                case_={c}
                            />
                        ))}
                    </div>
                </details>
            ))}
        </div>
    );
}
