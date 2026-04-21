'use client';

import type { ReactElement } from 'react';
import { SIGNAL_SECTORS } from '@/domain/constants/dashboard-tickers';
import { TabsUnderline } from '@/components/ui/tabs';

interface SectorTabsProps {
    activeSector: string;
    onChange: (sectorSymbol: string) => void;
}

const TABS_ID_PREFIX = 'sector';
const TAB_ITEMS = SIGNAL_SECTORS.map(s => ({
    value: s.symbol,
    label: s.koreanName,
}));

export function SectorTabs({ activeSector, onChange }: SectorTabsProps): ReactElement {
    return (
        <TabsUnderline
            tabs={TAB_ITEMS}
            activeTab={activeSector}
            onChange={onChange}
            ariaLabel="섹터 선택"
            size="sm"
            idPrefix={TABS_ID_PREFIX}
        />
    );
}
