'use client';

import { cn } from '@/shared/lib/cn';

interface ReanalyzeButtonProps {
    onClick: () => void;
    /**
     * ui-warning 강조 스타일. spec §2: 옵션 분석이 실제로 수행됐는데 OI 스냅샷이
     * stale일 때 사용자에게 "정규장 진입 후 다시 돌리세요"를 자연스럽게
     * 유도하기 위한 시각적 hint.
     */
    highlighted: boolean;
}

/**
 * 항상 분석 done 화면에 노출되는 재분석 CTA. 클릭 시 hook이 `reanalyze` **의도**만
 * 보내고, 실제 캐시 우회 여부는 서버가 재분석 쿨다운 획득으로 정한다
 * (`useOverallAnalysis.trigger` 참고). 쿨다운 중이면 직전 분석이 그대로 유지된다.
 */
export function ReanalyzeButton({
    onClick,
    highlighted,
}: ReanalyzeButtonProps) {
    return (
        <div className="flex justify-center pt-2">
            <button
                type="button"
                onClick={onClick}
                className={cn(
                    'rounded-lg px-4 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none',
                    highlighted
                        ? 'bg-ui-warning/15 text-ui-warning-text ring-ui-warning hover:bg-ui-warning/25 focus-visible:ring-ui-warning ring-1'
                        : 'border-border-control bg-secondary-800 text-secondary-200 hover:bg-secondary-700 focus-visible:ring-primary-400 border'
                )}
            >
                재분석
            </button>
        </div>
    );
}
