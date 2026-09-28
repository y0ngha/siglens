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
    ReplaySteps,
} from '@/shared/ui/ReplayParts';
import { LpReplaySources } from './LpReplaySources';

interface Props {
    readonly scenarios: readonly ReplayScenario[];
    /** `SITE_HOST`, passed down so this client module doesn't pull in `shared/lib/seo`. */
    readonly host: string;
    /** Rendered on the server so this client module stays icon-free. */
    readonly doneIcon: ReactNode;
}

/**
 * The address-bar replay from `siglens.io/about` (`views/about/ui/ReportReplay`),
 * copied here with fixed Korean labels: the `/lp` root has no intl provider and
 * views may not import another view slice. Playback, SSR and reduced-motion rules
 * come from the same `useReplayPlayback`, so both behave identically.
 */
export function LpReportReplay({ scenarios, host, doneIcon }: Props) {
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
            aria-label="SIGLENS 분석 과정 예시"
            className="flex w-full flex-col overflow-hidden rounded-lg border border-secondary-700 bg-secondary-800"
        >
            <div className="flex min-h-12 items-center gap-2 border-b border-secondary-700 px-3 sm:px-4">
                <p
                    className="flex min-h-8 min-w-0 flex-1 items-center rounded-lg bg-secondary-900 px-3 text-sm text-secondary-400"
                    translate="no"
                >
                    <span>{host}/</span>
                    <span className="truncate text-secondary-100">
                        {scenario.question.slice(0, frame.typed)}
                    </span>
                    {typing ? <ReplayCaret /> : null}
                </p>
                <span className="shrink-0 rounded bg-secondary-700/40 px-2 py-1 text-xs text-secondary-300">
                    예시 화면
                </span>
                {animated ? (
                    <ReplayPauseButton
                        paused={paused}
                        onToggle={togglePaused}
                        pauseLabel="일시정지"
                        resumeLabel="다시 재생"
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
                    <LpReplaySources
                        label="근거"
                        sources={scenario.sources}
                        asOf={scenario.asOf}
                    />
                ) : null}
            </div>
        </div>
    );
}
