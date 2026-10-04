'use client';

import { SectionSkeleton } from '@/views/symbol/SectionSkeleton';
import { usePendingSymbolTab } from '@/views/symbol/SymbolTabPendingContext';
import SymbolLoading from './loading';
import OptionsLoading from './options/loading';

/**
 * 탭 본문이 섹션 카드의 세로 목록인 탭과 그 첫 화면의 대략적인 섹션 수.
 * `overall`·`news`·`fundamental`은 각 탭 `loading.tsx`와 같은 수다.
 */
const SECTION_COUNT_BY_TAB: Readonly<Record<string, number>> = {
    overall: 3,
    news: 5,
    fundamental: 6,
    financials: 4,
    congress: 4,
    'fear-greed': 4,
    position: 3,
};

/**
 * 같은 종목 안에서 탭을 옮기는 순간 `[symbol]` 레이아웃의 page slot에 그리는 골격.
 *
 * 예전에는 어느 탭으로 가든 차트 탭의 "로딩 중" 화면 하나였다. 탭 `loading.tsx`의
 * 골격들은 ISR 응답이 통째로 도착하는 지금 내비게이션 중에는 뜰 일이 없어서
 * (`SymbolTabPendingContext` JSDoc), **목적지 탭의 모양**을 여기서 직접 고른다.
 *
 * 종목 레이아웃 안이라 `app.symbol` 메시지를 쓸 수 있다(`RouteMessages route="[symbol]"`).
 */
export function SymbolTabSkeleton() {
    const pendingHref = usePendingSymbolTab();
    const tab = pendingHref?.split('/')[2] ?? '';
    if (tab === 'options') return <OptionsLoading />;
    if (Object.hasOwn(SECTION_COUNT_BY_TAB, tab)) {
        return (
            <div
                data-symbol-tab-skeleton={tab}
                className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8"
            >
                {Array.from(
                    { length: SECTION_COUNT_BY_TAB[tab] ?? 0 },
                    (_, i) => (
                        <SectionSkeleton key={i} />
                    )
                )}
            </div>
        );
    }
    // 차트 탭(두 번째 세그먼트 없음)과 모르는 탭.
    return <SymbolLoading />;
}
