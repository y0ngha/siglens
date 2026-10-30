/**
 * 섹터 요약의 항목 하나 — 섹터명, 상승·하락 신호 종목 수, 대표 종목 링크.
 */
import { useTranslations } from 'next-intl';
import { useAssetLabel } from '@/shared/i18n/assetLabel';
import type { DisplayedSectorFact } from '../../utils/displayedSectorFacts';
import { TopStockLinks } from './TopStockLinks';

interface SectorFactItemProps {
    fact: DisplayedSectorFact;
    /** 카탈로그에 라벨이 없을 때 쓸 섹터명. */
    fallbackName: string;
}

/** 섹터명은 탭과 같은 소스(`assetLabel`)로 로케일화한다. */
export function SectorFactItem({ fact, fallbackName }: SectorFactItemProps) {
    const t = useTranslations('widgets.dashboard');
    const assetLabel = useAssetLabel();
    return (
        <div>
            <dt className="mb-1 font-medium text-secondary-400">
                {assetLabel(fact.sectorSymbol, fallbackName)}
            </dt>
            <dd>
                {t('SectorFactsSummary.e6dcde', {
                    v0: fact.bullishCount,
                    v1: fact.bearishCount,
                })}
                <TopStockLinks stocks={fact.topStocks} />
            </dd>
        </div>
    );
}
