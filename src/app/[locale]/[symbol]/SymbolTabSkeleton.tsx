'use client';

import { SectionSkeleton } from '@/views/symbol/SectionSkeleton';
import {
    SYMBOL_TAB_SECTION_COUNT,
    isSectionSkeletonTab,
} from '@/views/symbol/tabSkeletonSections';
import { usePendingSymbolTab } from '@/views/symbol/SymbolTabPendingContext';
import SymbolLoading from './loading';
import OptionsLoading from './options/loading';

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
    if (isSectionSkeletonTab(tab)) {
        return (
            <div
                data-symbol-tab-skeleton={tab}
                className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8"
            >
                {Array.from(
                    { length: SYMBOL_TAB_SECTION_COUNT[tab] },
                    (_, i) => (
                        <SectionSkeleton key={i} />
                    )
                )}
            </div>
        );
    }
    // 나머지는 차트 로딩 화면으로 둔다. 차트 탭은 본문이 jail을 꽉 채우는 한 덩어리라
    // 섹션 골격이 맞지 않고, 모르는 탭은 모양을 짐작해 그리느니 중립적인 화면이 낫다.
    return <SymbolLoading />;
}
