'use client';

import { useTranslations } from 'next-intl';
import { useAssetLabel } from '@/shared/i18n/assetLabel';
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
    const t = useTranslations('widgets.dashboard');
    const assetLabel = useAssetLabel();
    // `koreanName`은 프롬프트로 흘러가는 한국어 상수다. 탭 라벨은 심볼로
    // 카탈로그를 찾는다 — 안 그러면 영어 페이지 탭만 한국어로 남는다.
    const tabs = sectors.map(s => ({
        value: s.symbol,
        label: assetLabel(s.symbol, s.koreanName),
    }));
    return (
        <TabsUnderline
            tabs={tabs}
            activeTab={activeSector}
            onChange={onChange}
            ariaLabel={t('SectorTabs.651e5e')}
            size="sm"
            idPrefix={TABS_ID_PREFIX}
        />
    );
}
