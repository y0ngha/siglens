'use client';

/**
 * 패널 하단 재분석 버튼 — 분석 중·쿨다운 동안 문구를 바꾸고 누를 수 없게 한다.
 */
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import {
    formatCooldown,
    selectReanalyzeLabelKind,
    type ReanalyzeLabelKind,
} from '../utils/reanalyzeLabel';

interface ReanalyzeButtonProps {
    isAnalyzing: boolean;
    reanalyzeCooldownMs: number;
    onReanalyze: () => void;
    /** 포인터가 올라가거나 포커스가 갈 때 — 누르기 직전의 의도 신호. */
    onIntent?: () => void;
}

/**
 * 비활성은 `disabled`가 아니라 `aria-disabled`로 표현한다(REACT.md#AX-3) — 포커스를
 * 받는 순간(`onIntent`가 쿨다운을 읽어 옴) 또는 누른 직후(분석 시작) 비활성으로
 * 바뀌는데, `disabled`면 포커스가 `body`로 떨어져 키보드 사용자가 위치를 잃는다.
 * 클릭은 핸들러에서 막는다.
 */
export function ReanalyzeButton({
    isAnalyzing,
    reanalyzeCooldownMs,
    onReanalyze,
    onIntent,
}: ReanalyzeButtonProps) {
    const t = useTranslations('widgets.analysis');
    const tPanel = useTranslations('widgets.analysis.panel');
    const kind = selectReanalyzeLabelKind(isAnalyzing, reanalyzeCooldownMs);
    const isDisabled = kind !== 'idle';
    // 키를 이 파일의 리터럴 호출로 둔다 — extract.mjs가 클라이언트 키로 정적 수집한다.
    const labelByKind: Record<ReanalyzeLabelKind, () => string> = {
        analyzing: () => tPanel('analyzing'),
        cooldown: () =>
            tPanel('reanalyzeCooldown', {
                v0: formatCooldown(reanalyzeCooldownMs),
            }),
        idle: () => tPanel('reanalyze'),
    };
    return (
        <button
            type="button"
            onClick={() => {
                if (!isDisabled) onReanalyze();
            }}
            onPointerEnter={onIntent}
            onFocus={onIntent}
            aria-disabled={isDisabled}
            title={kind === 'cooldown' ? t('AnalysisPanel.550fe5') : undefined}
            className={cn(
                'w-full rounded-lg px-4 py-2 text-sm font-semibold tabular-nums transition-colors focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none',
                isDisabled
                    ? 'cursor-not-allowed bg-primary-600/40 text-secondary-300'
                    : 'bg-primary-600 text-white hover:bg-primary-700'
            )}
        >
            {labelByKind[kind]()}
        </button>
    );
}
