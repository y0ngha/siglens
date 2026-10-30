/**
 * 시장 요약 패널의 섹터 그룹 하나 — 그룹 라벨과 섹터 ETF 카드 그리드.
 */
import { useTranslations } from 'next-intl';
import type { MarketSectorData } from '@y0ngha/siglens-core';
import type { ClientDashboardScope } from '@/shared/config/dashboardScope';
import { cn } from '@/shared/lib/cn';
import { LABEL_KO } from '@/shared/lib/typographyStyles';
import { sectorGridClass } from '../../utils/marketGridClasses';
import { sectorGroupLabelKey } from '../../utils/marketLabelKeys';
import { IndexCard } from './IndexCard';

interface SectorGroupSectionProps {
    /** 그룹 라벨 원문 — 메시지 키가 없으면 그대로 보여 준다(빈 화면보다 낫다). */
    label: string;
    sectors: readonly MarketSectorData[];
    scope: ClientDashboardScope;
}

/**
 * 모바일에서는 2열로 접는다(`sectorGridClass`). 반응형 접두사가 없으면 320px에서 카드가
 * 눌리고 `shrink-0`인 등락률 배지가 카드를 넘겨 가격이 잘린다. `linkSectorCards`인
 * 시장은 카드가 섹터 ETF 페이지로 가는 내부 링크가 된다(SEO).
 */
export function SectorGroupSection({
    label,
    sectors,
    scope,
}: SectorGroupSectionProps) {
    const t = useTranslations('widgets.dashboard');
    const labelKey = sectorGroupLabelKey(label);
    return (
        <div>
            <p className={cn('mb-1.5', LABEL_KO)}>
                {labelKey === undefined ? label : t(labelKey)}
            </p>
            <div className={sectorGridClass(sectors.length)}>
                {sectors.map(etf => (
                    <IndexCard
                        key={etf.symbol}
                        data={etf}
                        currencySymbol={scope.currencySymbol}
                        tickerIsReadable={scope.tickerIsReadable}
                        {...(scope.linkSectorCards
                            ? { href: `/${etf.symbol}` }
                            : {})}
                    />
                ))}
            </div>
        </div>
    );
}
