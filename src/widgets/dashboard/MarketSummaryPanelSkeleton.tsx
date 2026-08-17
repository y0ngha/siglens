import {
    MARKET_INDICES,
    SECTOR_GROUPS,
} from '@/shared/config/dashboard-tickers';

export function MarketSummaryPanelSkeleton() {
    return (
        <section
            aria-label="시장 현황 로딩 중"
            className="px-6 py-10 lg:px-[15vw]"
            aria-busy="true"
        >
            <div className="mb-6 h-3.5 w-16 animate-pulse rounded bg-secondary-700/50" />
            <div className="flex flex-col gap-6" aria-hidden="true">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {MARKET_INDICES.map(idx => (
                        <div
                            key={idx.symbol}
                            className="h-[80px] animate-pulse rounded-lg border border-secondary-700 bg-secondary-800/50"
                        />
                    ))}
                </div>
                <div className="flex flex-col gap-3">
                    {SECTOR_GROUPS.map(group => (
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
