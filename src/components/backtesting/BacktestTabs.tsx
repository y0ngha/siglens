'use client';

import type { ReactElement } from 'react';
import type { BacktestCase } from '@/domain/types';
import { TabsUnderline, buildTabId, buildPanelId } from '@/components/ui/tabs';
import { useBacktestFilter } from './hooks/useBacktestFilter';
import { BacktestCaseList } from './BacktestCaseList';

interface BacktestTabsProps {
    cases: BacktestCase[];
    tickers: string[];
}

const TABS_ID_PREFIX = 'backtest';

export function BacktestTabs({ cases, tickers }: BacktestTabsProps): ReactElement {
    const { tabItems, activeTab, setActiveTab, filtered } = useBacktestFilter(
        cases,
        tickers
    );

    return (
        <div>
            <TabsUnderline
                tabs={tabItems}
                activeTab={activeTab}
                onChange={setActiveTab}
                ariaLabel="티커 필터"
                size="xs"
                idPrefix={TABS_ID_PREFIX}
            />

            <div
                id={buildPanelId(TABS_ID_PREFIX, activeTab)}
                role="tabpanel"
                aria-labelledby={buildTabId(TABS_ID_PREFIX, activeTab)}
            >
                <BacktestCaseList cases={filtered} />
            </div>
        </div>
    );
}
