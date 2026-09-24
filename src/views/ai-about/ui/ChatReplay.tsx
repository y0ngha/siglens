'use client';

import type { ReactNode } from 'react';
import { useReplayPlayback } from '@/shared/hooks/useReplayPlayback';
import {
    revealLines,
    type ReplayScenario,
} from '@/shared/lib/replay/replayScript';
import {
    ReplayCaret,
    ReplayLines,
    ReplayPauseButton,
    ReplaySources,
    ReplaySteps,
} from '@/shared/ui/ReplayParts';

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

/**
 * The auto-playing example conversation on `/about`: the question types
 * itself into the user bubble, lookups light up one by one and fold into a
 * summary line, then the answer streams in with its sources.
 *
 * Playback, SSR and pause rules live in `useReplayPlayback`; the steps, body
 * and sources are the shared `ReplayParts`. This component only owns the chat
 * chrome (the SIGLENS AI header, the user bubble, the avatar).
 */
export function ChatReplay({ scenarios, labels, avatar, doneIcon }: Props) {
    const { frame, paused, togglePaused, animated, rootRef, threadRef } =
        useReplayPlayback(scenarios);

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
                    <ReplayPauseButton
                        paused={paused}
                        onToggle={togglePaused}
                        pauseLabel={labels.pause}
                        resumeLabel={labels.resume}
                    />
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
                        {typing ? <ReplayCaret /> : null}
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
                                <ReplaySteps
                                    tools={scenario.tools.slice(
                                        0,
                                        frame.toolsShown
                                    )}
                                    done={frame.toolsDone}
                                />
                            )}
                            {frame.summary ? (
                                <ReplayLines
                                    lines={scenario.lines}
                                    reveal={reveal}
                                />
                            ) : null}
                            {frame.sources ? (
                                <ReplaySources
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
