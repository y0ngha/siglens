'use client';

import { MS_PER_MINUTE } from '@/domain/constants/time';

const STALE_MESSAGE =
    'AI 분석 데이터가 오래되었습니다. 최신 시장가를 반영하려면 재분석을 실행해 주세요.';
const REANALYZE_LABEL = '재분석';

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
            <button
                type="button"
                onClick={onReanalyze}
                disabled={isCoolingDown}
                title={
                    isCoolingDown
                        ? `재분석은 ${cooldownMinutes}분에 한 번만 실행할 수 있어요.`
                        : undefined
                }
                className="border-ui-warning/40 hover:bg-ui-warning/20 focus-visible:ring-primary-500 rounded-md border px-2 py-1 text-xs font-medium focus-visible:ring-1 focus-visible:outline-none disabled:opacity-40"
            >
                {REANALYZE_LABEL}
            </button>
        </div>
    );
}
