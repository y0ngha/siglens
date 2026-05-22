interface ReanalyzeButtonProps {
    onClick: () => void;
    /**
     * Amber 강조 스타일. spec §2: 옵션 분석이 실제로 수행됐는데 OI 스냅샷이
     * stale일 때 사용자에게 "정규장 진입 후 다시 돌리세요"를 자연스럽게
     * 유도하기 위한 시각적 hint.
     */
    highlighted: boolean;
}

/**
 * 항상 분석 done 화면에 노출되는 재분석 CTA. 클릭 시 hook이 4-axis 전체에
 * force=true를 전달해 캐시를 우회한다 (`useOverallAnalysis.trigger` 참고).
 */
export function ReanalyzeButton({ onClick, highlighted }: ReanalyzeButtonProps) {
    return (
        <div className="flex justify-center pt-2">
            <button
                type="button"
                onClick={onClick}
                className={
                    highlighted
                        ? 'rounded-md bg-amber-900/30 px-4 py-2 text-sm font-medium text-amber-200 ring-1 ring-amber-500/40 hover:bg-amber-900/40 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none'
                        : 'border-secondary-600 bg-secondary-800 text-secondary-200 hover:bg-secondary-700 focus-visible:ring-primary-400 rounded-md border px-4 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none'
                }
            >
                재분석
            </button>
        </div>
    );
}
