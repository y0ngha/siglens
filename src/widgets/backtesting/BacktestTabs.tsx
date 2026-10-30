'use client';

import { useTranslations } from 'next-intl';
import { type ReactNode, useRef } from 'react';
import { buildPanelId, buildTabId } from '@/shared/ui/tabs/utils/tabIds';
import { TabsUnderline } from '@/shared/ui/tabs/TabsUnderline';
import { useBacktestFilter } from '@/features/backtest-filter/hooks/useBacktestFilter';
import { useCaseListVisibility } from './hooks/useCaseListVisibility';

interface BacktestTabsProps {
    tickers: string[];
    /**
     * 서버에서 렌더된 케이스 목록(`BacktestCaseList`).
     *
     * 클라이언트 컴포넌트가 케이스 배열을 받아 카드를 그리면 배열 전체가 RSC 페이로드에
     * 실리고 카드가 전부 하이드레이션된다. 상호작용은 종목 탭 하나뿐이라 목록은 서버가
     * 그리고, 탭은 보이는 범위만 고른다(`useCaseListVisibility`).
     */
    children: ReactNode;
}

const TABS_ID_PREFIX = 'backtest';

export function BacktestTabs({ tickers, children }: BacktestTabsProps) {
    const t = useTranslations('widgets.backtesting');
    const panelRef = useRef<HTMLDivElement>(null);
    const { tabItems, activeTab, setActiveTab, isFiltered } =
        useBacktestFilter(tickers);
    useCaseListVisibility(panelRef, isFiltered ? activeTab : null);

    return (
        <div>
            <TabsUnderline
                tabs={tabItems}
                activeTab={activeTab}
                onChange={setActiveTab}
                ariaLabel={t('BacktestTabs.7425e7')}
                size="xs"
                idPrefix={TABS_ID_PREFIX}
                panelMounting="active"
            />

            <div
                ref={panelRef}
                id={buildPanelId(TABS_ID_PREFIX, activeTab)}
                role="tabpanel"
                aria-labelledby={buildTabId(TABS_ID_PREFIX, activeTab)}
            >
                {children}
            </div>
        </div>
    );
}
