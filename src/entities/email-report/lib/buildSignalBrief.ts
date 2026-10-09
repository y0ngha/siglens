import {
    scoreConfluence,
    type ConfluenceSnapshot,
    type PullbackSnapshot,
} from '@y0ngha/siglens-core';
import type { SignalBrief } from '../reportModel';

export interface SignalBriefInput {
    /** `evaluateConfluence(bars, { timeframe: '1Day' })` — HTF 게이트 없이. */
    confluence: ConfluenceSnapshot | null;
    /** `evaluatePullback(bars)`. */
    pullback: PullbackSnapshot | null;
}

/**
 * core 스냅샷 두 개를 메일용 {@link SignalBrief}로 옮긴다(순수).
 *
 * siglens는 판정 규칙을 만들지 않는다 — 점수는 `scoreConfluence`, 타입 목록은 스냅샷
 * 그대로, 눌림목은 core의 `reading`이다. `entryTrigger`/`exitTrigger`는 읽지 않는다.
 * 보류(`confluence === null`)는 점수 `null`로 남긴다 — 템플릿이 "—"로 그린다.
 */
export function buildSignalBrief(input: SignalBriefInput): SignalBrief {
    const { confluence, pullback } = input;
    const pullbackReading =
        pullback === null || pullback.reading === 'none'
            ? null
            : pullback.reading;
    if (confluence === null) {
        return {
            score: null,
            bullish: [],
            bearish: [],
            fresh: [],
            pullback: pullbackReading,
        };
    }
    return {
        score: scoreConfluence(confluence),
        bullish: [...confluence.bullish],
        bearish: [...confluence.bearish],
        fresh: [
            ...new Set([
                ...confluence.freshBullish,
                ...confluence.freshBearish,
            ]),
        ].toSorted(),
        pullback: pullbackReading,
    };
}
