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

export interface ReportReplayLabels {
    /** `SITE_HOST`, passed down so this client module doesn't pull in `shared/lib/seo`. */
    readonly host: string;
    readonly region: string;
    readonly badge: string;
    readonly pause: string;
    readonly resume: string;
    readonly sources: string;
}

interface Props {
    readonly scenarios: readonly ReplayScenario[];
    readonly labels: ReportReplayLabels;
    /** Rendered on the server so this client module stays icon-free. */
    readonly doneIcon: ReactNode;
}

/**
 * The auto-playing example on `siglens.io/about`: a ticker types itself into
 * an address bar (`siglens.io/AAPL`), the analysis steps light up one by one
 * and fold into a summary line, then the report streams in with what it was
 * based on.
 *
 * An address bar rather than a search box on purpose: a box that looks
 * typeable but isn't reads as broken (feedback on the ai.siglens.io replay).
 * Searching for real happens in the site header.
 *
 * Playback, SSR and pause rules live in `useReplayPlayback`; the steps, body
 * and sources are the shared `ReplayParts`.
 */
export function ReportReplay({ scenarios, labels, doneIcon }: Props) {
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
            className="flex w-full flex-col overflow-hidden rounded-lg border border-secondary-700 bg-secondary-800"
        >
            <div className="flex min-h-12 items-center gap-2 border-b border-secondary-700 px-3 sm:px-4">
                <p
                    className="flex min-h-8 min-w-0 flex-1 items-center rounded-lg bg-secondary-900 px-3 text-sm text-secondary-400"
                    translate="no"
                >
                    <span>{labels.host}/</span>
                    <span className="truncate text-secondary-100">
                        {scenario.question.slice(0, frame.typed)}
                    </span>
                    {typing ? <ReplayCaret /> : null}
                </p>
                <span className="shrink-0 rounded bg-secondary-700/40 px-2 py-1 text-xs text-secondary-300">
                    {labels.badge}
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
                className="flex h-[480px] flex-col gap-3 overflow-hidden p-4 text-[15px] leading-7 text-secondary-200 sm:h-[320px] sm:px-6 sm:py-5"
            >
                {frame.summary ? (
                    <p className="flex items-center gap-1.5 text-xs text-secondary-400">
                        {doneIcon}
                        {scenario.summary}
                    </p>
                ) : frame.toolsShown > 0 ? (
                    <ReplaySteps
                        tools={scenario.tools.slice(0, frame.toolsShown)}
                        done={frame.toolsDone}
                    />
                ) : null}
                {frame.summary ? (
                    <ReplayLines lines={scenario.lines} reveal={reveal} />
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
    );
}
