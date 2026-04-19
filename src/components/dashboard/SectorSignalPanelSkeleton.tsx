import { SECTOR_ETFS } from '@/domain/constants/dashboard-tickers';

export function SectorSignalPanelSkeleton() {
    return (
        <section
            aria-label="섹터 신호 로딩 중"
            aria-busy="true"
            className="sector-panel-bg relative px-6 py-10 lg:px-[15vw]"
        >
            <div className="mb-6 flex items-center justify-between">
                <div className="bg-secondary-700/50 h-3.5 w-24 animate-pulse rounded" />
                <div className="bg-secondary-700/50 h-3.5 w-20 animate-pulse rounded" />
            </div>
            <div className="flex gap-6 overflow-x-auto border-b border-secondary-700 pb-2">
                {SECTOR_ETFS.map(etf => (
                    <div
                        key={etf.symbol}
                        className="bg-secondary-700/50 h-3 w-12 shrink-0 animate-pulse rounded"
                    />
                ))}
            </div>
            <div className="mt-6 flex flex-col gap-4">
                {[0, 1, 2, 3].map(i => (
                    <div key={i} className="flex flex-col gap-3 border-t border-secondary-700 pt-3 pb-4">
                        <div className="flex items-center justify-between">
                            <div className="bg-secondary-700/50 h-3 w-20 animate-pulse rounded" />
                            <div className="bg-secondary-700/50 h-6 w-8 animate-pulse rounded" />
                        </div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                            {[0, 1, 2, 3].map(j => (
                                <div
                                    key={j}
                                    className="bg-secondary-800/50 border-secondary-700 h-[120px] animate-pulse rounded-lg border"
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
