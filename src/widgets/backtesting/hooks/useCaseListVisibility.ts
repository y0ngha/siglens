'use client';

import { type RefObject, useLayoutEffect, useRef } from 'react';
import {
    applyCaseListVisibility,
    UNFILTERED_TOKEN,
} from '../utils/caseListVisibility';
import {
    type MonthOpenSnapshot,
    openAllMonths,
    restoreMonths,
} from '../utils/monthOpenState';

/**
 * 서버에서 렌더된 케이스 목록(`BacktestCaseList`) 안에서 지금 탭에 맞는 요소만 보이게 한다.
 *
 * 목록은 서버 컴포넌트라 React가 클라이언트에서 다시 그리지 않는다(`BacktestTabs`의
 * `children`은 탭이 바뀌어도 같은 엘리먼트다). 그래서 보이는 범위는 DOM의 `hidden`과
 * `<details open>`으로 직접 고른다 — React가 관리하는 prop이 아니므로 React와 다투지 않는다.
 *
 * - 종목 탭: 그 종목 카드·그 종목이 있는 월·그 종목 기준 월 건수만 보이고, 월은 전부 펼친다
 *   (이미 좁혀 본 것이라 접어 둘 이유가 없다). 보이는 카드가 없으면 안내 문구를 드러낸다.
 * - "전체" 탭(`activeTicker === null`): 모두 보인다. 월 펼침은 **건드리지 않는다** — 종목
 *   탭에서 돌아올 때만 떠나기 직전의 펼침 상태(사용자가 직접 열고 닫은 것 포함)로 되돌린다.
 * - 목록 자식이 바뀌면(서버 컴포넌트 새로고침 등) 같은 규칙을 다시 적용한다. 새로 들어온
 *   요소는 서버 HTML 그대로(전부 보임)라서, 다시 걸러 주지 않으면 필터가 풀린 채 남는다.
 *
 * ## `?ticker=` 딥링크는 "전체로 그린 뒤 거른다"
 *
 * 서버 HTML은 항상 "전체" 목록이다. 페이지가 ISR 정적 페이지라 서버가 `searchParams`를 읽으면
 * 동적 렌더로 바뀌어 캐시를 잃는다(`app/CLAUDE.md` ISR 규약). 그래서 `?ticker=AAPL`로 들어온
 * 방문자는 하이드레이션 직후 이 레이아웃 effect가 걸러 줄 때까지 전체 목록을 잠깐 본다.
 * 크롤러는 전체 목록을 받는 편이 오히려 맞다.
 *
 * 레이아웃 effect인 이유: 탭 클릭 직후 페인트에 걸러지기 전 목록이 한 프레임 비치지 않게.
 */
export function useCaseListVisibility(
    panelRef: RefObject<HTMLElement | null>,
    activeTicker: string | null
): void {
    // "전체" 탭을 떠날 때의 월 펼침 상태. 돌아올 때 그대로 되돌린다.
    const savedOpenRef = useRef<MonthOpenSnapshot | null>(null);

    useLayoutEffect(() => {
        const panel = panelRef.current;
        if (!panel) return;
        const token = activeTicker ?? UNFILTERED_TOKEN;

        const sync = (): void => {
            applyCaseListVisibility(panel, token);
            const months = Array.from(panel.querySelectorAll('details'));
            if (activeTicker !== null) {
                savedOpenRef.current ??= new Map();
                openAllMonths(months, savedOpenRef.current);
                return;
            }
            if (savedOpenRef.current === null) return;
            restoreMonths(months, savedOpenRef.current);
            savedOpenRef.current = null;
        };

        sync();
        // 속성(`hidden`/`open`) 변경은 보지 않는다 — sync가 바꾸는 값이라 되먹임이 생긴다.
        const observer = new MutationObserver(sync);
        observer.observe(panel, { childList: true, subtree: true });
        return () => observer.disconnect();
    }, [panelRef, activeTicker]);
}
