'use client';

import { MS_PER_MINUTE } from '@/domain/constants/time';

const STALE_MESSAGE =
    'AI 분석 결과가 오래됐어요. 지금 시장 가격을 반영하려면 재분석해 주세요.';
const REANALYZE_LABEL = '재분석';
const COOLDOWN_TOOLTIP_ID = 'stale-banner-cooldown-tooltip';

interface StaleAnalysisBannerProps {
    onReanalyze: () => void;
    reanalyzeCooldownMs: number;
}

export function StaleAnalysisBanner({
    onReanalyze,
    reanalyzeCooldownMs,
}: StaleAnalysisBannerProps) {
    const isCoolingDown = reanalyzeCooldownMs > 0;
    const cooldownMinutes = Math.ceil(reanalyzeCooldownMs / MS_PER_MINUTE);
    return (
        <div
            role="status"
            className="border-ui-warning/30 bg-ui-warning/10 text-ui-warning flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
        >
            <span>{STALE_MESSAGE}</span>
            <div className="relative inline-flex">
                <button
                    type="button"
                    onClick={onReanalyze}
                    disabled={isCoolingDown}
                    aria-describedby={
                        isCoolingDown ? COOLDOWN_TOOLTIP_ID : undefined
                    }
                    title={
                        isCoolingDown
                            ? `재분석은 ${cooldownMinutes}분에 한 번만 실행할 수 있어요.`
                            : undefined
                    }
                    className="border-ui-warning/40 hover:bg-ui-warning/20 focus-visible:ring-primary-500 rounded-md border px-2 py-1 text-xs font-medium focus-visible:ring-1 focus-visible:outline-none disabled:opacity-40"
                >
                    {REANALYZE_LABEL}
                </button>
                {isCoolingDown && (
                    <span
                        id={COOLDOWN_TOOLTIP_ID}
                        role="tooltip"
                        className="sr-only"
                    >
                        {`재분석은 ${cooldownMinutes}분에 한 번만 실행할 수 있어요.`}
                    </span>
                )}
            </div>
        </div>
    );
}
