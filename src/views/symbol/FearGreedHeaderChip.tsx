import type { FearGreedLabel, FearGreedSnapshot } from '@y0ngha/siglens-core';
import {
    CONFIDENCE_LIMITED_LABEL,
    SENTIMENT_LABEL_TEXT,
} from '@/shared/lib/fearGreedLabels';
import { cn } from '@/shared/lib/cn';

// alpha /40 vs /20 = EXTREME vs base intensity (no separate extreme tokens in design system).
// 텍스트는 반드시 `-text` 변형을 쓴다 — 기본 `ui-*`는 그래픽(3:1) 기준이라
// 자기 틴트 위 소형 텍스트로 쓰면 라이트에서 2.5~3.5:1로 미달한다.
const LABEL_BG: Record<FearGreedLabel, string> = {
    EXTREME_FEAR: 'bg-ui-danger/40 text-ui-danger-text',
    FEAR: 'bg-ui-danger/20 text-ui-danger-text',
    NEUTRAL: 'bg-secondary-700/40 text-secondary-200',
    GREED: 'bg-ui-success/20 text-ui-success-text',
    EXTREME_GREED: 'bg-ui-success/40 text-ui-success-text',
};

interface FearGreedHeaderChipProps {
    snapshot: FearGreedSnapshot | null;
}

/** Ticker-level sentiment chip on every /[symbol]/* route header. */
export function FearGreedHeaderChip({ snapshot }: FearGreedHeaderChipProps) {
    if (!snapshot) {
        return (
            <span className="inline-flex items-center rounded bg-secondary-700/40 px-2 py-0.5 text-xs text-secondary-400">
                공포·탐욕 데이터 부족
            </span>
        );
    }
    const score = Math.round(snapshot.score);
    const confidenceNote =
        snapshot.confidence === 'limited'
            ? ` (${CONFIDENCE_LIMITED_LABEL})`
            : '';
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium',
                LABEL_BG[snapshot.label]
            )}
            aria-label={`공포 탐욕 지수 ${SENTIMENT_LABEL_TEXT[snapshot.label]} ${score}점${confidenceNote}`}
        >
            <span>{SENTIMENT_LABEL_TEXT[snapshot.label]}</span>
            <span className="font-mono">{score}</span>
            {snapshot.confidence === 'limited' && (
                <span className="text-secondary-300" aria-hidden="true">
                    ⓘ
                </span>
            )}
        </span>
    );
}
