import { useTranslations } from 'next-intl';
import type { ClientDashboardScope } from '@/shared/config/dashboardScope';

interface MarketSummaryPanelSkeletonProps {
    /** 실제 패널과 같은 개수·배치의 자리를 잡기 위해 필요하다 — 시장마다 지수·섹터 수가 다르다. */
    scope: ClientDashboardScope;
}

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
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {scope.indices.map(idx => (
                        <div
                            key={idx.symbol}
                            className="h-[80px] animate-pulse rounded-lg border border-secondary-700 bg-secondary-800/50"
                        />
                    ))}
                </div>
                <div className="flex flex-col gap-3">
                    {scope.sectorGroups.map(group => (
                        <div key={group.label}>
                            <div className="mb-1.5 h-2.5 w-10 animate-pulse rounded bg-secondary-700/50" />
                            <div
                                className={`grid gap-2 ${group.symbols.length === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}
                            >
                                {group.symbols.map(sym => (
                                    <div
                                        key={sym}
                                        className="h-[80px] animate-pulse rounded-lg border border-secondary-700 bg-secondary-800/50"
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="h-[68px] animate-pulse rounded-lg border border-secondary-700 bg-secondary-800/50" />
            </div>
        </section>
    );
}
