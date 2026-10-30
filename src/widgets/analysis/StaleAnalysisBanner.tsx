'use client';

/**
 * 오래된 분석 안내 배너 — 타임프레임 임계값을 넘긴 분석 위에 재분석 버튼과 함께 띄운다.
 */
import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { MS_PER_MINUTE } from '@/shared/config/time';
import { cn } from '@/shared/lib/cn';
import { useCountdownMs } from './hooks/useCountdownMs';

interface StaleAnalysisBannerProps {
    onReanalyze: () => void;
    /** 버튼에 포인터·포커스가 갈 때 — 쿨다운 조회 시점(`AnalysisPanel` 참고). */
    onReanalyzeIntent?: () => void;
    /** 쿨다운이 끝나는 시각(epoch ms). 0이면 없음. */
    reanalyzeCooldownUntil: number;
}

/**
 * 쿨다운 중에는 `aria-disabled`로 막는다(REACT.md#AX-3) — 포커스를 받는 순간
 * `onReanalyzeIntent`가 쿨다운을 읽어 와 비활성으로 바뀌는데, `disabled`면 포커스가
 * `body`로 떨어진다. 툴팁 id는 `useId`로 만든다 — 패널이 데스크톱·모바일 시트에 두 번
 * 마운트돼 고정 id면 DOM에 중복 id가 생긴다.
 */
export function StaleAnalysisBanner({
    onReanalyze,
    onReanalyzeIntent,
    reanalyzeCooldownUntil,
}: StaleAnalysisBannerProps) {
    const t = useTranslations('widgets.analysis.staleBanner');
    const reanalyzeCooldownMs = useCountdownMs(reanalyzeCooldownUntil);
    const tooltipId = useId();
    const isCoolingDown = reanalyzeCooldownMs > 0;
    const cooldownMinutes = Math.ceil(reanalyzeCooldownMs / MS_PER_MINUTE);
    return (
        <div
            role="status"
            className="flex items-center justify-between gap-3 rounded-lg border border-ui-warning/30 bg-ui-warning/10 px-3 py-2 text-sm text-ui-warning-text"
        >
            <span>{t('message')}</span>
            <div className="relative inline-flex">
                <button
                    type="button"
                    onClick={() => {
                        if (!isCoolingDown) onReanalyze();
                    }}
                    onPointerEnter={onReanalyzeIntent}
                    onFocus={onReanalyzeIntent}
                    aria-disabled={isCoolingDown}
                    aria-describedby={isCoolingDown ? tooltipId : undefined}
                    title={
                        isCoolingDown
                            ? t('cooldown', { v0: cooldownMinutes })
                            : undefined
                    }
                    className={cn(
                        'rounded-lg border px-2 py-1 text-xs font-medium focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none',
                        isCoolingDown
                            ? 'cursor-not-allowed border-border-control text-secondary-500'
                            : 'border-ui-warning hover:bg-ui-warning/20'
                    )}
                >
                    {t('reanalyze')}
                </button>
                {isCoolingDown && (
                    <span id={tooltipId} role="tooltip" className="sr-only">
                        {t('cooldown', { v0: cooldownMinutes })}
                    </span>
                )}
            </div>
        </div>
    );
}
