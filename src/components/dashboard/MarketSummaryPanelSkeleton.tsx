import {
    MARKET_INDICES,
    SECTOR_GROUPS,
} from '@/domain/constants/dashboard-tickers';

export function MarketSummaryPanelSkeleton() {
    return (
        <section
            aria-label="시장 현황 로딩 중"
            className="px-6 py-10 lg:px-[15vw]"
            aria-busy="true"
        >
            <div className="bg-secondary-700/50 mb-6 h-3.5 w-16 animate-pulse rounded" />
            <div className="flex flex-col gap-6">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {MARKET_INDICES.map(idx => (
                        <div
                            key={idx.symbol}
                            className="bg-secondary-800/50 border-secondary-700 h-[80px] animate-pulse rounded-lg border"
                        />
                    ))}
                </div>
                <div className="flex flex-col gap-3">
                    {SECTOR_GROUPS.map(group => (
                        <div key={group.label}>
                            <div className="bg-secondary-700/50 mb-1.5 h-2.5 w-10 animate-pulse rounded" />
                            <div
                                className={`grid gap-2 ${group.symbols.length === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}
                            >
                                {group.symbols.map(sym => (
                                    <div
                                        key={sym}
                                        className="bg-secondary-800/50 border-secondary-700 h-[80px] animate-pulse rounded-lg border"
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="bg-secondary-800/50 border-secondary-700 h-[68px] animate-pulse rounded-lg border" />
            </div>
        </section>
    );
}
