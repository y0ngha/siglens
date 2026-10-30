/**
 * Turns a landing page's example answer into replay lines.
 */
import {
    parseReplayLine,
    type ReplayLine,
} from '@/shared/lib/replay/replayScript';

/**
 * The first and last lines are paragraphs (the lead and the takeaway); the
 * lines between are list items.
 */
export function toReplayLines(lines: readonly string[]): ReplayLine[] {
    const last = lines.length - 1;
    return lines.map((raw, i) =>
        parseReplayLine(i === 0 || i === last ? 'p' : 'li', raw)
    );
}
