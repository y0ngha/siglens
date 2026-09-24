'use client';

import { cn } from '@/shared/lib/cn';
import {
    groupLines,
    sliceSegments,
    type LineReveal,
    type ReplayLine,
    type ReplayTool,
    type Segment,
} from '@/shared/lib/replay/replayScript';

/**
 * Presentational pieces both `/about` replays draw a `Frame` with
 * (`ChatReplay` on ai.siglens.io, `ReportReplay` on siglens.io). The replays
 * differ only in their chrome — a chat bubble vs. an address bar — so the
 * steps, streamed body, and sources line live here once.
 */

const TONE_CLASS: Readonly<Record<Segment['tone'], string | null>> = {
    plain: null,
    strong: 'font-semibold text-secondary-50 tabular-nums',
    up: 'font-semibold text-ui-success-text tabular-nums',
    down: 'font-semibold text-ui-danger-text tabular-nums',
};

interface SegmentsProps {
    readonly segments: readonly Segment[];
}

function Segments({ segments }: SegmentsProps) {
    return segments.map((segment, i) => {
        const cls = TONE_CLASS[segment.tone];
        return cls === null ? (
            segment.text
        ) : (
            <strong key={i} className={cls}>
                {segment.text}
            </strong>
        );
    });
}

export const ReplayCaret = () => (
    <span
        aria-hidden="true"
        className="ml-px inline-block h-[1em] w-[7px] translate-y-[2px] bg-secondary-300 motion-safe:animate-pulse"
    />
);

interface ReplayStepsProps {
    readonly tools: readonly ReplayTool[];
    /** How many of `tools` have finished. */
    readonly done: number;
}

/** The lookups/steps lighting up one by one: pending pulses, done turns green. */
export function ReplaySteps({ tools, done }: ReplayStepsProps) {
    return (
        <ul className="flex flex-wrap gap-1.5">
            {tools.map((tool, t) => {
                const finished = t < done;
                return (
                    <li
                        key={tool.label}
                        className={cn(
                            'inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs',
                            finished
                                ? 'border-secondary-700 text-secondary-400'
                                : 'border-border-control text-secondary-200'
                        )}
                    >
                        <span
                            aria-hidden="true"
                            className={cn(
                                'size-1.5 rounded-full',
                                finished
                                    ? 'bg-ui-success'
                                    : 'bg-secondary-300 motion-safe:animate-pulse'
                            )}
                        />
                        {finished ? tool.label : tool.pendingLabel}
                        <span className="text-secondary-400 tabular-nums">
                            {tool.subject}
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}

interface ReplayLinesProps {
    readonly lines: readonly ReplayLine[];
    readonly reveal: readonly LineReveal[];
}

/** The streamed body: paragraphs and bullet runs, each cut at its reveal point. */
export function ReplayLines({ lines, reveal }: ReplayLinesProps) {
    return (
        <div className="flex flex-col gap-2">
            {groupLines(lines).map(group => {
                const visible = group.items.filter(
                    ({ index }) => reveal[index]!.shown > 0
                );
                if (visible.length === 0) return null;
                const rendered = visible.map(({ line, index }) => {
                    const { shown, caret } = reveal[index]!;
                    const body = (
                        <>
                            <Segments
                                segments={sliceSegments(line.segments, shown)}
                            />
                            {caret ? <ReplayCaret /> : null}
                        </>
                    );
                    return group.kind === 'li' ? (
                        <li key={index}>{body}</li>
                    ) : (
                        <p key={index}>{body}</p>
                    );
                });
                const key = group.items[0]!.index;
                return group.kind === 'li' ? (
                    <ul
                        key={key}
                        className="flex list-disc flex-col gap-1 pl-5 marker:text-secondary-400"
                    >
                        {rendered}
                    </ul>
                ) : (
                    <div key={key} className="flex flex-col gap-2">
                        {rendered}
                    </div>
                );
            })}
        </div>
    );
}

interface ReplaySourcesProps {
    readonly label: string;
    readonly sources: readonly string[];
    readonly asOf: string;
}

export function ReplaySources({ label, sources, asOf }: ReplaySourcesProps) {
    return (
        <p className="flex flex-wrap items-center gap-1.5 border-t border-dashed border-secondary-700 pt-2.5 text-xs text-secondary-400">
            {label}
            {sources.map(source => (
                <span
                    key={source}
                    className="rounded bg-secondary-700/40 px-2 py-0.5 font-medium text-secondary-300"
                >
                    {source}
                </span>
            ))}
            <span className="tabular-nums">· {asOf}</span>
        </p>
    );
}

interface ReplayPauseButtonProps {
    readonly paused: boolean;
    readonly onToggle: () => void;
    readonly pauseLabel: string;
    readonly resumeLabel: string;
}

export function ReplayPauseButton({
    paused,
    onToggle,
    pauseLabel,
    resumeLabel,
}: ReplayPauseButtonProps) {
    return (
        <button
            type="button"
            aria-pressed={paused}
            onClick={onToggle}
            className="inline-flex min-h-8 items-center rounded-lg border border-border-control px-2.5 text-xs text-secondary-300 hover:text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
        >
            {paused ? resumeLabel : pauseLabel}
        </button>
    );
}
