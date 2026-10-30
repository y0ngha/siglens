/**
 * 시장 요약 패널 Suspense fallback — 실제 패널과 같은 그리드 열 구성의 자리 표시.
 */
import { useTranslations } from 'next-intl';
import type { ClientDashboardScope } from '@/shared/config/dashboardScope';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { INDEX_GRID_CLASS, sectorGridClass } from './utils/marketGridClasses';

interface MarketSummaryPanelSkeletonProps {
    /** 실제 패널과 같은 개수·배치의 자리를 잡기 위해 필요하다 — 시장마다 지수·섹터 수가 다르다. */
    scope: ClientDashboardScope;
}

/** 지수·섹터 그룹·브리핑 자리를 시장별 개수대로 잡는다. 열 구성은 실제 패널과 같은 상수를 쓴다. */
export function MarketSummaryPanelSkeleton({
    scope,
}: MarketSummaryPanelSkeletonProps) {
    const t = useTranslations('widgets.dashboard');
    return (
        <section
            aria-label={t('MarketSummaryPanelSkeleton.dc6348')}
            className="page-container py-10"
            aria-busy="true"
        >
            <div className="mb-6 h-3.5 w-16 animate-pulse rounded bg-secondary-700/50" />
            <div className="flex flex-col gap-6" aria-hidden="true">
                <div className={INDEX_GRID_CLASS}>
                    {scope.indices.map(idx => (
                        <div
                            key={idx.symbol}
                            className={cn(
                                SURFACE_CARD,
                                'h-[80px] animate-pulse'
                            )}
                        />
                    ))}
                </div>
                <div className="flex flex-col gap-3">
                    {scope.sectorGroups.map(group => (
                        <div key={group.label}>
                            <div className="mb-1.5 h-2.5 w-10 animate-pulse rounded bg-secondary-700/50" />
                            <div
                                className={sectorGridClass(
                                    group.symbols.length
                                )}
                            >
                                {group.symbols.map(sym => (
                                    <div
                                        key={sym}
                                        className={cn(
                                            SURFACE_CARD,
                                            'h-[80px] animate-pulse'
                                        )}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                <div className={cn(SURFACE_CARD, 'h-[68px] animate-pulse')} />
            </div>
        </section>
    );
}
