import {
    MARKET_INDICES,
    SECTOR_ETFS,
} from '@/domain/constants/dashboard-tickers';

export function MarketSummaryPanelSkeleton() {
    return (
        <section
            aria-label="시장 현황 로딩 중"
            className="px-6 py-10 lg:px-[15vw]"
            aria-busy="true"
        >
            <div className="bg-secondary-700/50 mb-6 h-3.5 w-16 animate-pulse rounded" />
            <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {MARKET_INDICES.map(idx => (
                        <div
                            key={idx.symbol}
                            className="bg-secondary-800/50 border-secondary-700 h-[80px] animate-pulse rounded-lg border"
                        />
                    ))}
                </div>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-11">
                    {SECTOR_ETFS.map(etf => (
                        <div
                            key={etf.symbol}
                            className="bg-secondary-800/50 border-secondary-700 h-[80px] animate-pulse rounded-lg border"
                        />
                    ))}
                </div>
                <div className="bg-secondary-800/50 border-secondary-700 h-[68px] animate-pulse rounded-lg border" />
            </div>
        </section>
    );
}
