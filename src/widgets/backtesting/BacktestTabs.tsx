'use client';

import { useTranslations } from 'next-intl';
import type { BacktestCase } from '@y0ngha/siglens-core';
import { buildPanelId, buildTabId } from '@/shared/ui/tabs/utils/tabIds';
import { TabsUnderline } from '@/shared/ui/tabs/TabsUnderline';
import { useBacktestFilter } from '@/features/backtest-filter/hooks/useBacktestFilter';
import { BacktestCaseList } from './BacktestCaseList';

interface BacktestTabsProps {
    cases: BacktestCase[];
    tickers: string[];
}

const TABS_ID_PREFIX = 'backtest';

export function BacktestTabs({ cases, tickers }: BacktestTabsProps) {
    const t = useTranslations('widgets.backtesting');
    const { tabItems, activeTab, setActiveTab, filtered, isFiltered } =
        useBacktestFilter(cases, tickers);

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
                {/* 종목을 골랐으면 그 종목의 케이스를 월 접힘 없이 전부 보여 준다. */}
                <BacktestCaseList cases={filtered} openAll={isFiltered} />
            </div>
        </div>
    );
}
