export function OptionsAiAnalysisSkeleton() {
    return (
        <section
            className="border-secondary-700 bg-secondary-800 rounded-xl border p-6"
            aria-busy="true"
            aria-label="AI 옵션 분석 불러오는 중"
        >
            <div className="flex items-center gap-2">
                <div className="border-primary-500 h-3 w-3 animate-spin rounded-full border-2 border-t-transparent" />
                <span className="text-secondary-400 text-xs tracking-widest uppercase">
                    AI 옵션 분석 생성 중
                </span>
            </div>
            <div className="mt-4 space-y-2">
                <div className="bg-secondary-700 h-3 w-full animate-pulse rounded" />
                <div className="bg-secondary-700 h-3 w-[92%] animate-pulse rounded" />
                <div className="bg-secondary-700 h-3 w-4/5 animate-pulse rounded" />
                <div className="bg-secondary-700 h-3 w-3/5 animate-pulse rounded" />
                <div className="bg-secondary-700 h-3 w-2/3 animate-pulse rounded" />
            </div>
        </section>
    );
}
