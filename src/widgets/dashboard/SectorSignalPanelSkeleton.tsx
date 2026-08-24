import type { ClientDashboardScope } from '@/shared/config/dashboardScope';

interface SectorSignalPanelSkeletonProps {
    /** 섹터 탭 자리 개수가 시장마다 다르다(미국 13 / 한국 6). */
    scope: ClientDashboardScope;
}

export function SectorSignalPanelSkeleton({
    scope,
}: SectorSignalPanelSkeletonProps) {
    return (
        <section
            aria-label="섹터 신호 로딩 중"
            aria-busy="true"
            className="page-container sector-panel-bg relative py-10"
        >
            {/* 의미 없는 pulse 영역은 aria-hidden으로 스크린리더에서 숨기고, 상위 section의 aria-label만 안내한다. */}
            <div
                className="mb-6 flex items-center justify-between"
                aria-hidden="true"
            >
                <div className="h-3.5 w-24 animate-pulse rounded bg-secondary-700/50" />
                <div className="h-3.5 w-20 animate-pulse rounded bg-secondary-700/50" />
            </div>
            <div
                className="flex gap-6 overflow-x-auto border-b border-secondary-700 pb-2"
                aria-hidden="true"
            >
                {scope.signalSectors.map(etf => (
                    <div
                        key={etf.symbol}
                        className="h-3 w-12 shrink-0 animate-pulse rounded bg-secondary-700/50"
                    />
                ))}
            </div>
            <div className="mt-6 flex flex-col gap-4" aria-hidden="true">
                {[0, 1, 2, 3].map(i => (
                    <div
                        key={i}
                        className="flex flex-col gap-3 border-t border-secondary-700 pt-3 pb-4"
                    >
                        <div className="flex items-center justify-between">
                            <div className="h-3 w-20 animate-pulse rounded bg-secondary-700/50" />
                            <div className="h-6 w-8 animate-pulse rounded bg-secondary-700/50" />
                        </div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                            {[0, 1, 2, 3].map(j => (
                                <div
                                    key={j}
                                    className="h-[120px] animate-pulse rounded-lg border border-secondary-700 bg-secondary-800/50"
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
