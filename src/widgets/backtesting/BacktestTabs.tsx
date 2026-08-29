'use client';

import { useTranslations } from 'next-intl';
import type { BacktestCase } from '@y0ngha/siglens-core';
import { buildPanelId, buildTabId, TabsUnderline } from '@/shared/ui/tabs';
import { useBacktestFilter } from '@/features/backtest-filter';
import { BacktestCaseList } from './BacktestCaseList';

interface BacktestTabsProps {
    cases: BacktestCase[];
    tickers: string[];
}

const TABS_ID_PREFIX = 'backtest';

export function BacktestTabs({ cases, tickers }: BacktestTabsProps) {
    const t = useTranslations('widgets.backtesting');
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
                ariaLabel={t('BacktestTabs.7425e7')}
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
