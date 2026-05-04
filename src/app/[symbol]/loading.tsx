// Layout (`/[symbol]/layout.tsx`) already renders the breadcrumb + tabs, so this
// fallback only fills the page slot below the layout header while the chart page
// resolves its data. The chart page renders its own TimeframeSelector once mounted.
export default function SymbolLoading() {
    return (
        <div className="bg-secondary-900 text-secondary-200 flex min-h-0 flex-1 flex-col overflow-hidden">
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
