'use client';

import {
    useEffect,
    useRef,
    useState,
    useSyncExternalStore,
    type ReactNode,
} from 'react';
import { cn } from '@/shared/lib/cn';
import {
    lineLength,
    pickNextIndex,
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

/** What is on screen at one instant of the replay. */
interface Frame {
    readonly index: number;
    readonly typed: number;
    readonly toolsShown: number;
    readonly toolsDone: number;
    readonly summary: boolean;
    readonly chars: number;
    readonly sources: boolean;
}

const COMPLETE = Number.MAX_SAFE_INTEGER;
const completeFrame = (index: number): Frame => ({
    index,
    typed: COMPLETE,
    toolsShown: COMPLETE,
    toolsDone: COMPLETE,
    summary: true,
    chars: COMPLETE,
    sources: true,
});

const TYPE_MS = 38;
const STREAM_STEP = 3;
const STREAM_MS = 28;
const HOLD_MS = 5200;
const TICK_MS = 40;

const TONE_CLASS: Readonly<Record<Segment['tone'], string | null>> = {
    plain: null,
    strong: 'font-semibold text-secondary-50 tabular-nums',
    up: 'font-semibold text-ui-success-text tabular-nums',
    down: 'font-semibold text-ui-danger-text tabular-nums',
};

function Segments({ segments }: { readonly segments: readonly Segment[] }) {
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

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
const subscribeMotion = (onChange: () => void) => {
    const query = window.matchMedia(REDUCED_MOTION);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
};
/** Playback runs only on the client and only without a reduced-motion preference. */
const useCanAnimate = () =>
    useSyncExternalStore(
        subscribeMotion,
        () => !window.matchMedia(REDUCED_MOTION).matches,
        () => false
    );

const Caret = () => (
    <span
        aria-hidden="true"
        className="ml-px inline-block h-[1em] w-[7px] translate-y-[2px] bg-primary-400 motion-safe:animate-pulse"
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
    const animated = useCanAnimate();
    const pausedRef = useRef(false);
    const visibleRef = useRef(true);
    const rootRef = useRef<HTMLDivElement>(null);
    const threadRef = useRef<HTMLDivElement>(null);

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

        // Real time only counts while playing and on screen.
        const wait = (ms: number) =>
            new Promise<void>((resolve, reject) => {
                let left = ms;
                let last = Date.now();
                const tick = () => {
                    if (cancelled) return reject(new Error('cancelled'));
                    const now = Date.now();
                    if (!pausedRef.current && visibleRef.current)
                        left -= now - last;
                    last = now;
                    if (left <= 0) return resolve();
                    const id = setTimeout(tick, Math.min(left, TICK_MS));
                    timers.add(id);
                };
                tick();
            });

        const play = async (index: number, firstRun: boolean) => {
            const scenario = scenarios[index]!;
            const base: Frame = {
                index,
                typed: 0,
                toolsShown: 0,
                toolsDone: 0,
                summary: false,
                chars: 0,
                sources: false,
            };
            await wait(firstRun ? 300 : 900);
            setFrame(base);
            for (let i = 1; i <= scenario.question.length; i++) {
                setFrame({ ...base, typed: i });
                await wait(TYPE_MS * (0.6 + Math.random() * 0.8));
            }
            await wait(350);
            const typed = scenario.question.length;
            for (let t = 0; t < scenario.tools.length; t++) {
                setFrame({ ...base, typed, toolsShown: t + 1, toolsDone: t });
                await wait(scenario.tools[t]!.ms);
                setFrame({
                    ...base,
                    typed,
                    toolsShown: t + 1,
                    toolsDone: t + 1,
                });
                await wait(120);
            }
            await wait(350);
            const total = scenario.lines.reduce(
                (sum, line) => sum + lineLength(line),
                0
            );
            for (let c = 0; c <= total; c += STREAM_STEP) {
                setFrame({ ...base, typed, summary: true, chars: c });
                await wait(STREAM_MS);
            }
            setFrame({ ...completeFrame(index) });
            await wait(HOLD_MS);
        };

        void (async () => {
            let index = Math.floor(Math.random() * scenarios.length);
            let firstRun = true;
            try {
                while (!cancelled) {
                    await play(index, firstRun);
                    firstRun = false;
                    index = pickNextIndex(scenarios.length, index);
                }
            } catch {
                // cancelled on unmount
            }
        })();

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

    const scenario = scenarios[frame.index]!;
    const typing = frame.typed < scenario.question.length;
    const streaming = frame.summary && !frame.sources;
    const reveal = revealLines(
        scenario.lines,
        frame.summary ? frame.chars : 0,
        streaming
    );

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

function ToolChips({
    tools,
    done,
}: {
    readonly tools: readonly ReplayTool[];
    /** How many of `tools` have finished. */
    readonly done: number;
}) {
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
                                : 'border-primary-500 text-secondary-200'
                        )}
                    >
                        <span
                            aria-hidden="true"
                            className={cn(
                                'size-1.5 rounded-full',
                                finished
                                    ? 'bg-ui-success'
                                    : 'bg-primary-400 motion-safe:animate-pulse'
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

function AnswerLines({
    lines,
    reveal,
}: {
    readonly lines: readonly ReplayLine[];
    readonly reveal: readonly LineReveal[];
}) {
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

function SourcesLine({
    label,
    sources,
    asOf,
}: {
    readonly label: string;
    readonly sources: readonly string[];
    readonly asOf: string;
}) {
    return (
        <p className="flex flex-wrap items-center gap-1.5 border-t border-dashed border-secondary-700 pt-2.5 text-xs text-secondary-400">
            {label}
            {sources.map(source => (
                <span
                    key={source}
                    className="rounded bg-primary-500/10 px-2 py-0.5 font-medium text-primary-400"
                >
                    {source}
                </span>
            ))}
            <span className="tabular-nums">· {asOf}</span>
        </p>
    );
}

interface LineGroup {
    readonly kind: ReplayLine['kind'];
    readonly items: { readonly line: ReplayLine; readonly index: number }[];
}

/** Consecutive lines of the same kind render as one `<ul>` or one run of `<p>`. */
function groupLines(lines: readonly ReplayLine[]): LineGroup[] {
    const groups: LineGroup[] = [];
    lines.forEach((line, index) => {
        const last = groups.at(-1);
        if (last && last.kind === line.kind) last.items.push({ line, index });
        else groups.push({ kind: line.kind, items: [{ line, index }] });
    });
    return groups;
}
