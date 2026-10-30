/**
 * Turns a playback `Frame` into what both replay chromes draw from it, so
 * `ChatReplay` and `ReportReplay` don't each re-derive the caret, the typed
 * input and the streamed body cut points.
 */

import {
    revealLines,
    type LineReveal,
    type ReplayScenario,
} from '@/shared/lib/replay/replayScript';
import type { Frame } from '@/widgets/replay/utils/replayPlayer';

/** The render-ready view of one `Frame`. */
export interface ReplayView {
    readonly scenario: ReplayScenario;
    /** The part of the question / ticker typed so far. */
    readonly typedQuestion: string;
    /** The question is still being typed: the input shows a caret. */
    readonly typing: boolean;
    /** Something below the input has started: steps or the folded summary. */
    readonly answerStarted: boolean;
    /** Per-line cut points of the body; all zero until the summary folds in. */
    readonly reveal: readonly LineReveal[];
}

/** Derives the `ReplayView` of `frame` from the scenario it points at. */
export function deriveReplayView(
    scenarios: readonly ReplayScenario[],
    frame: Frame
): ReplayView {
    const scenario = scenarios[frame.index]!;
    const streaming = frame.summary && !frame.sources;
    return {
        scenario,
        typedQuestion: scenario.question.slice(0, frame.typed),
        typing: frame.typed < scenario.question.length,
        answerStarted: frame.toolsShown > 0 || frame.summary,
        reveal: revealLines(
            scenario.lines,
            frame.summary ? frame.chars : 0,
            streaming
        ),
    };
}
