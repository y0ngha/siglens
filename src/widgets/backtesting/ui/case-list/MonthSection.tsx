import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import {
    UNFILTERED_TOKEN,
    visibilityAttrs,
} from '../../utils/caseListVisibility';
import {
    type CaseMonthGroup,
    splitMonthKey,
} from '../../utils/groupCasesByMonth';

interface MonthSectionProps {
    group: CaseMonthGroup;
    /** 처음부터 펼쳐 둘지. */
    defaultOpen: boolean;
    /** 이 달의 카드들. 카드 조립은 목록 오케스트레이터가 한다(리프가 상위를 import하지 않게). */
    children: ReactNode;
}

/**
 * 월 하나의 접이식 구획 — 월 헤딩·건수 요약과 그 달의 카드들.
 *
 * 문장 조립(`backtestMonth`)은 번역자를 선언한 이 컴포넌트가 한다. 헬퍼가 리터럴 키로
 * 번역자를 부르면 추출기가 그 파일을 통째로 건너뛴다.
 */
export function MonthSection({
    group,
    defaultOpen,
    children,
}: MonthSectionProps) {
    const t = useTranslations('widgets.backtesting');
    const tMisc = useTranslations('shared.ui.misc');
    const { year, month } = splitMonthKey(group.key);

    return (
        <details
            open={defaultOpen}
            {...visibilityAttrs([
                UNFILTERED_TOKEN,
                ...group.countByTicker.keys(),
            ])}
            className="group"
        >
            {/* `<summary>` 안에 헤딩을 둔다(HTML이 허용하는 구성). 접힌 상태에서도 헤딩
                탐색으로 월을 건너뛸 수 있다(SC 1.3.1). 기본 삼각형 마커는 지우고 같은
                뜻의 셰브런을 직접 그린다. */}
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
                    {tMisc('backtestMonth', { v0: year, v1: month })}
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
                {Array.from(group.countByTicker, ([ticker, count]) => (
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
            <div className="flex flex-col gap-2 pt-1">{children}</div>
        </details>
    );
}
