/** The streamed replay body: paragraphs and bullet runs cut at their reveal points. */

import {
    groupLines,
    sliceSegments,
    type LineGroup,
    type LineReveal,
    type ReplayLine,
    type Segment,
} from '@/shared/lib/replay/replayScript';
import { ReplayCaret } from '@/widgets/replay/ui/body/ReplayCaret';

const TONE_CLASS: Readonly<Record<Segment['tone'], string | null>> = {
    plain: null,
    strong: 'font-semibold text-secondary-50 tabular-nums',
    up: 'font-semibold text-ui-success-text tabular-nums',
    down: 'font-semibold text-ui-danger-text tabular-nums',
};

interface SegmentsProps {
    readonly segments: readonly Segment[];
}

/** Plain runs render as text; `<b>`/`<up>`/`<down>` runs as toned `<strong>`. */
function Segments({ segments }: SegmentsProps) {
    return segments.map((segment, i) => {
        const cls = TONE_CLASS[segment.tone];
        if (cls === null) return segment.text;
        return (
            <strong key={i} className={cls}>
                {segment.text}
            </strong>
        );
    });
}

interface LineBodyProps {
    readonly line: ReplayLine;
    readonly reveal: LineReveal;
}

/** One line's visible characters, plus the caret while it is the streaming line. */
function LineBody({ line, reveal }: LineBodyProps) {
    return (
        <>
            <Segments segments={sliceSegments(line.segments, reveal.shown)} />
            {reveal.caret ? <ReplayCaret /> : null}
        </>
    );
}

interface LineGroupProps {
    readonly group: LineGroup;
    readonly reveal: readonly LineReveal[];
}

/** A run of same-kind lines: one `<ul>` of bullets or one stack of `<p>`. */
function LineGroupView({ group, reveal }: LineGroupProps) {
    const visible = group.items.filter(({ index }) => reveal[index]!.shown > 0);
    if (visible.length === 0) return null;
    if (group.kind === 'li') {
        return (
            <ul className="flex list-disc flex-col gap-1 pl-5 marker:text-secondary-400">
                {visible.map(({ line, index }) => (
                    <li key={index}>
                        <LineBody line={line} reveal={reveal[index]!} />
                    </li>
                ))}
            </ul>
        );
    }
    return (
        <div className="flex flex-col gap-2">
            {visible.map(({ line, index }) => (
                <p key={index}>
                    <LineBody line={line} reveal={reveal[index]!} />
                </p>
            ))}
        </div>
    );
}

interface ReplayLinesProps {
    readonly lines: readonly ReplayLine[];
    readonly reveal: readonly LineReveal[];
}

/** Draws `lines` grouped by kind, showing only what `reveal` has streamed so far. */
export function ReplayLines({ lines, reveal }: ReplayLinesProps) {
    return (
        <div className="flex flex-col gap-2">
            {groupLines(lines).map(group => (
                <LineGroupView
                    key={group.items[0]!.index}
                    group={group}
                    reveal={reveal}
                />
            ))}
        </div>
    );
}
