'use client';

/**
 * 전문가 리포트 복사 버튼 — 복사 상태(idle/copied/failed)에 따라 문구·색을 바꾼다.
 */
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import type { CopyReportState } from '../model/types';

/**
 * 복사 결과(`copied`/`failed`) 표시 모양. 반투명 틴트 보더는 컨트롤 보더 가드의
 * 이름 단위 예외(`ALLOWED_CONSTANTS`)다 — 잠깐 보이는 결과 표시이고 상태는 보더가
 * 아니라 문구("복사됨"/"복사 실패")와 채움이 전한다. 평상시 `idle`은 예외에 넣지 않고
 * 여는 태그 안에 둬서 가드가 계속 본다.
 */
const RESULT_CLASSES: Record<Exclude<CopyReportState, 'idle'>, string> = {
    copied: 'border-primary-400/40 bg-primary-400/10 text-primary-300',
    failed: 'border-chart-bearish/40 bg-chart-bearish/10 text-ui-danger-text',
};

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
                // 진행 중 모양은 `aria-disabled:` 변형이라 controlBorderTokenGuard가
                // 비활성(WCAG 1.4.11 면제)으로 읽는다. 그래서 예외 목록이 필요 없다.
                isBusy
                    ? 'aria-disabled:border-secondary-700 aria-disabled:text-secondary-500 aria-disabled:cursor-not-allowed'
                    : copyState === 'idle'
                      ? 'border-border-control text-secondary-300 hover:border-primary-500 hover:text-secondary-100'
                      : RESULT_CLASSES[copyState]
            )}
            title={
                isBusy ? t('AnalysisPanel.39c545') : t('AnalysisPanel.32f681')
            }
        >
            {labelByState[copyState]()}
        </button>
    );
}
