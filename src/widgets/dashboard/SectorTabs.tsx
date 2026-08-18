'use client';

import type { SectorEtf } from '@y0ngha/siglens-core';
import { TabsUnderline } from '@/shared/ui/tabs';

interface SectorTabsProps {
    /** 노출할 섹터. 모듈 상수로 굳히면 한국 패널이 미국 섹터 탭을 그린다. */
    sectors: readonly SectorEtf[];
    activeSector: string;
    onChange: (sectorSymbol: string) => void;
}

const TABS_ID_PREFIX = 'sector';

export function SectorTabs({
    sectors,
    activeSector,
    onChange,
}: SectorTabsProps) {
    const tabs = sectors.map(s => ({ value: s.symbol, label: s.koreanName }));
    return (
        <TabsUnderline
            tabs={tabs}
            activeTab={activeSector}
            onChange={onChange}
            ariaLabel="섹터 선택"
            size="sm"
            idPrefix={TABS_ID_PREFIX}
        />
    );
}
