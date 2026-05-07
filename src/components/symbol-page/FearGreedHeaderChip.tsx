'use client';

import type { FearGreedSnapshot } from '@y0ngha/siglens-core';
import { cn } from '@/lib/cn';

const LABEL_TEXT: Record<FearGreedSnapshot['label'], string> = {
    EXTREME_FEAR: '극공포',
    FEAR: '공포',
    NEUTRAL: '중립',
    GREED: '탐욕',
    EXTREME_GREED: '극탐욕',
};

/**
 * 5단계 sentiment 컬러 매핑. globals.css의 semantic tokens만 사용.
 *
 * Tokens 출처 (src/app/globals.css):
 * - --color-ui-danger   (#ef5350) → 공포(약세) 시그널
 * - --color-ui-success  (#26a69a) → 탐욕(강세) 시그널
 * - --color-secondary-* (slate)   → 중립 / 데이터 부족 placeholder
 *
 * 강도 차이는 별도 토큰(ui-danger-extreme 등)이 없으므로 alpha 단계
 * (/40 vs /20)로 표현한다. EXTREME = /40, 일반 = /20.
 */
const LABEL_BG: Record<FearGreedSnapshot['label'], string> = {
    EXTREME_FEAR: 'bg-ui-danger/40 text-ui-danger',
    FEAR: 'bg-ui-danger/20 text-ui-danger',
    NEUTRAL: 'bg-secondary-700/40 text-secondary-200',
    GREED: 'bg-ui-success/20 text-ui-success',
    EXTREME_GREED: 'bg-ui-success/40 text-ui-success',
};

interface FearGreedHeaderChipProps {
    snapshot: FearGreedSnapshot | null;
}

/** Ticker-level sentiment chip on every /[symbol]/* route header. */
export function FearGreedHeaderChip({ snapshot }: FearGreedHeaderChipProps) {
    if (!snapshot) {
        return (
            <span className="bg-secondary-700/40 text-secondary-400 inline-flex items-center rounded px-2 py-0.5 text-xs">
                F&G 데이터 부족
            </span>
        );
    }
    const score = Math.round(snapshot.score);
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium',
                LABEL_BG[snapshot.label]
            )}
            aria-label={`공포·탐욕 지수 ${LABEL_TEXT[snapshot.label]} ${score}점`}
        >
            <span>{LABEL_TEXT[snapshot.label]}</span>
            <span className="font-mono">{score}</span>
            {snapshot.confidence === 'limited' && (
                <span className="text-secondary-300" aria-hidden>
                    ⓘ
                </span>
            )}
        </span>
    );
}
