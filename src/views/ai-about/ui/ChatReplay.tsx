'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { useCanAnimate } from '../hooks/useCanAnimate';
import {
    completeFrame,
    runPlayback,
    type Frame,
    type PlaybackContext,
} from '../lib/replayPlayer';
import {
    groupLines,
    revealLines,
    sliceSegments,
    type LineReveal,
    type ReplayLine,
    type ReplayScenario,
    type ReplayTool,
    type Segment,
} from '../lib/replayScript';

export interface ChatReplayLabels {
    readonly region: string;
    readonly pause: string;
    readonly resume: string;
    readonly sources: string;
}

interface Props {
    readonly scenarios: readonly ReplayScenario[];
    readonly labels: ChatReplayLabels;
    /**
     * Rendered on the server and handed down as elements: pulling the
     * `widgets/agent-chat` barrel into this client module would drag the whole
     * chat shell into the /about bundle.
     */
    readonly avatar: ReactNode;
    readonly doneIcon: ReactNode;
}

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

const Caret = () => (
    <span
        aria-hidden="true"
        className="ml-px inline-block h-[1em] w-[7px] translate-y-[2px] bg-secondary-300 motion-safe:animate-pulse"
    />
);

/**
 * The auto-playing example conversation on `/about`: the question types
 * itself into the user bubble, lookups light up one by one and fold into a
 * summary line, then the answer streams in with its sources.
 *
 * SSR and the first client render show the first scenario complete, so
 * crawlers and a no-JS reader get a whole conversation and hydration matches.
 * Playback starts after mount unless the reader prefers reduced motion. It
 * pauses while the card is off screen or the pause button is pressed —
 * motion that runs on its own for more than five seconds needs a stop control
 * (WCAG 2.2.2).
 */
export function ChatReplay({ scenarios, labels, avatar, doneIcon }: Props) {
    const [frame, setFrame] = useState<Frame>(() => completeFrame(0));
    const [paused, setPaused] = useState(false);
    const pausedRef = useRef(false);
    const visibleRef = useRef(true);
    const rootRef = useRef<HTMLDivElement>(null);
    const threadRef = useRef<HTMLDivElement>(null);
    const animated = useCanAnimate();

    const scenario = scenarios[frame.index]!;
    const typing = frame.typed < scenario.question.length;
    const streaming = frame.summary && !frame.sources;
    const reveal = revealLines(
        scenario.lines,
        frame.summary ? frame.chars : 0,
        streaming
    );

    useEffect(() => {
        pausedRef.current = paused;
    }, [paused]);

    useEffect(() => {
        const root = rootRef.current;
        if (!root || typeof IntersectionObserver === 'undefined') return;
        const observer = new IntersectionObserver(entries => {
            visibleRef.current = entries[0]?.isIntersecting ?? true;
        });
        observer.observe(root);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!animated) return;
        let cancelled = false;
        const timers = new Set<ReturnType<typeof setTimeout>>();
        const ctx: PlaybackContext = {
            scenarios,
            setFrame,
            isCancelled: () => cancelled,
            isRunning: () => !pausedRef.current && visibleRef.current,
            addTimer: id => {
                timers.add(id);
            },
            random: Math.random,
        };

        void runPlayback(ctx);

        return () => {
            cancelled = true;
            for (const id of timers) clearTimeout(id);
        };
    }, [animated, scenarios]);

    // Keep the newest text in view once an answer outgrows the fixed card.
    useEffect(() => {
        const thread = threadRef.current;
        if (thread) thread.scrollTop = thread.scrollHeight;
    }, [frame]);

    return (
        <div
            ref={rootRef}
            role="region"
            aria-label={labels.region}
            className="mx-auto flex w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-secondary-700 bg-secondary-800"
        >
            <div className="flex min-h-12 items-center justify-between gap-2 border-b border-secondary-700 px-4 text-xs text-secondary-400">
                <span className="inline-flex items-center gap-2 font-mono tracking-wider">
                    <span
                        aria-hidden="true"
                        className="size-1.5 rounded-full bg-ui-success"
                    />
                    <span translate="no">SIGLENS AI</span>
                </span>
                {animated ? (
                    <button
                        type="button"
                        aria-pressed={paused}
                        onClick={() => setPaused(p => !p)}
                        className="inline-flex min-h-8 items-center rounded-lg border border-border-control px-2.5 text-xs text-secondary-300 hover:text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                    >
                        {paused ? labels.resume : labels.pause}
                    </button>
                ) : null}
            </div>
            <div
                ref={threadRef}
                aria-live="off"
                className="flex h-[520px] flex-col gap-4 overflow-hidden p-4 sm:h-[420px]"
            >
                {frame.typed > 0 ? (
                    <div className="max-w-[85%] self-end rounded-lg border border-secondary-700 bg-secondary-900 px-4 py-2.5 text-[15px] leading-6 break-words text-secondary-100">
                        {scenario.question.slice(0, frame.typed)}
                        {typing ? <Caret /> : null}
                    </div>
                ) : null}
                {frame.toolsShown > 0 || frame.summary ? (
                    <div className="flex items-start gap-3">
                        {avatar}
                        <div className="flex min-w-0 flex-1 flex-col gap-2.5 text-[15px] leading-7 text-secondary-200">
                            {frame.summary ? (
                                <p className="flex items-center gap-1.5 text-xs text-secondary-400">
                                    {doneIcon}
                                    {scenario.summary}
                                </p>
                            ) : (
                                <ToolChips
                                    tools={scenario.tools.slice(
                                        0,
                                        frame.toolsShown
                                    )}
                                    done={frame.toolsDone}
                                />
                            )}
                            {frame.summary ? (
                                <AnswerLines
                                    lines={scenario.lines}
                                    reveal={reveal}
                                />
                            ) : null}
                            {frame.sources ? (
                                <SourcesLine
                                    label={labels.sources}
                                    sources={scenario.sources}
                                    asOf={scenario.asOf}
                                />
                            ) : null}
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}

interface ToolChipsProps {
    readonly tools: readonly ReplayTool[];
    /** How many of `tools` have finished. */
    readonly done: number;
}

function ToolChips({ tools, done }: ToolChipsProps) {
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

interface AnswerLinesProps {
    readonly lines: readonly ReplayLine[];
    readonly reveal: readonly LineReveal[];
}

function AnswerLines({ lines, reveal }: AnswerLinesProps) {
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
                            {caret ? <Caret /> : null}
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

interface SourcesLineProps {
    readonly label: string;
    readonly sources: readonly string[];
    readonly asOf: string;
}

function SourcesLine({ label, sources, asOf }: SourcesLineProps) {
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
