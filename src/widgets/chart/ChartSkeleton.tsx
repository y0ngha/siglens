export function ChartSkeleton() {
    return (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-secondary-900/60">
            <span className="text-sm text-secondary-400">데이터 로딩 중…</span>
        </div>
    );
}
