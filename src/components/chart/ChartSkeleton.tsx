export function ChartSkeleton() {
    return (
        <div className="bg-secondary-900/60 absolute inset-0 z-10 flex items-center justify-center">
            <span className="text-secondary-400 text-sm">
                데이터 로딩 중...
            </span>
        </div>
    );
}
