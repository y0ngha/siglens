'use client';

/**
 * 전문가 리포트 복사 버튼 — 복사 상태(idle/copied/failed)에 따라 문구·색을 바꾼다.
 */
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import type { CopyReportState } from '../model/types';

interface CopyReportButtonProps {
    copyState: CopyReportState;
    /** 분석 진행 중 — 곧 바뀔 결과를 복사하지 않도록 비활성화한다. */
    isBusy: boolean;
    onCopy: () => void;
}

/**
 * 진행 중 비활성은 `aria-disabled`로 표현한다(REACT.md#AX-3) — 포커스가 머문 채 분석이
 * 시작되면 `disabled`는 포커스를 `body`로 떨어뜨린다. 복사 자체는
 * `useCopyAnalysisReport`가 진행 중에 거른다.
 */
export function CopyReportButton({
    copyState,
    isBusy,
    onCopy,
}: CopyReportButtonProps) {
    const t = useTranslations('widgets.analysis');
    // 키를 이 파일의 리터럴 호출로 둔다 — extract.mjs가 클라이언트 키로 정적 수집한다.
    const labelByState: Record<CopyReportState, () => string> = {
        copied: () => t('AnalysisPanel.e5c85b'),
        failed: () => t('AnalysisPanel.e815ab'),
        idle: () => t('AnalysisPanel.32f681'),
    };
    return (
        <button
            type="button"
            onClick={onCopy}
            aria-disabled={isBusy}
            className={cn(
                'focus-visible:ring-primary-500 min-h-11 touch-manipulation rounded border px-2 py-1 text-xs font-medium whitespace-nowrap transition-colors focus-visible:ring-1 focus-visible:outline-none',
                // 상태별 색은 이 여는 태그 안에 둔다 — controlBorderTokenGuard의
                // 요소 예외가 이 태그 단위로 걸려 있어, 상수로 빼면 검사 대상이 바뀐다.
                isBusy
                    ? 'border-secondary-700 text-secondary-500 cursor-not-allowed'
                    : {
                          copied: 'border-primary-400/40 bg-primary-400/10 text-primary-300',
                          failed: 'border-chart-bearish/40 bg-chart-bearish/10 text-ui-danger-text',
                          idle: 'border-border-control text-secondary-300 hover:border-primary-500 hover:text-secondary-100',
                      }[copyState]
            )}
            title={
                isBusy ? t('AnalysisPanel.39c545') : t('AnalysisPanel.32f681')
            }
        >
            {labelByState[copyState]()}
        </button>
    );
}
