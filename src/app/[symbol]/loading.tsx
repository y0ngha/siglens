export default function SymbolLoading() {
    return (
        <div className="bg-secondary-900 text-secondary-200 flex h-screen flex-col overflow-hidden">
            <header className="border-secondary-700 border-b px-4 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="bg-secondary-700 h-3 w-14 animate-pulse rounded" />
                        <span className="text-secondary-700">/</span>
                        <div className="bg-secondary-600 h-5 w-20 animate-pulse rounded" />
                    </div>
                    <div className="hidden items-center gap-3 md:flex">
                        {/* TickerAutocomplete placeholder */}
                        <div className="bg-secondary-700 h-8 w-32 animate-pulse rounded-lg" />
                        {/* TimeframeSelector placeholder */}
                        <div className="bg-secondary-700 hidden h-8 w-48 animate-pulse rounded-lg sm:block" />
                    </div>
                </div>
                {/* Mobile TimeframeSelector placeholder */}
                <div className="bg-secondary-700 mt-2 h-8 w-48 animate-pulse rounded-lg sm:hidden" />
            </header>
            <div className="relative flex min-h-0 flex-1 overflow-hidden">
                <div className="bg-secondary-900/60 absolute inset-0 z-10 flex items-center justify-center">
                    <span className="text-secondary-400 text-sm">
                        데이터 로딩 중…
                    </span>
                </div>
            </div>
        </div>
    );
}
