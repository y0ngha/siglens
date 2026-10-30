'use client';

/** The auto-playing example analysis on siglens.io `/about` and the `/lp` analysis landing. */

import type { ReactNode } from 'react';
import type { ReplayScenario } from '@/shared/lib/replay/replayScript';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { cn } from '@/shared/lib/cn';
import { useReplayPlayback } from '@/widgets/replay/hooks/useReplayPlayback';
import { deriveReplayView } from '@/widgets/replay/utils/replayView';
import { ReplayAnswer } from '@/widgets/replay/ui/body/ReplayAnswer';
import { ReplayCaret } from '@/widgets/replay/ui/body/ReplayCaret';
import { ReplayPauseButton } from '@/widgets/replay/ui/controls/ReplayPauseButton';

interface ReportReplayLabels {
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
    /**
     * The `|` divider before the as-of time in the sources line. The ad
     * landings (`/lp`) turn it off: their copy carries no divider symbols.
     */
    readonly sourcesSeparator?: boolean;
}

/**
 * The auto-playing example on `siglens.io/about`: a ticker types itself into
 * an address bar (`siglens.io/AAPL`), the analysis steps light up one by one
 * and fold into a summary line, then the report streams in with what it was
 * based on.
 *
 * An address bar rather than a search box on purpose: a box that looks
 * typeable but isn't reads as broken. Searching for real happens in the site
 * header.
 *
 * Playback, SSR and pause rules live in `useReplayPlayback`; the steps, body
 * and sources are `ReplayAnswer`.
 */
export function ReportReplay({
    scenarios,
    labels,
    doneIcon,
    sourcesSeparator = true,
}: Props) {
    const { frame, paused, togglePaused, animated, rootRef, threadRef } =
        useReplayPlayback(scenarios);

    const view = deriveReplayView(scenarios, frame);

    return (
        <div
            ref={rootRef}
            role="region"
            aria-label={labels.region}
            className={cn(SURFACE_CARD, 'flex w-full flex-col overflow-hidden')}
        >
            <div className="flex min-h-12 items-center gap-2 border-b border-secondary-700 px-3 sm:px-4">
                <p
                    className="flex min-h-8 min-w-0 flex-1 items-center rounded-lg bg-secondary-900 px-3 text-sm text-secondary-400"
                    translate="no"
                >
                    <span>{labels.host}/</span>
                    <span className="truncate text-secondary-100">
                        {view.typedQuestion}
                    </span>
                    {view.typing ? <ReplayCaret /> : null}
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
                <ReplayAnswer
                    view={view}
                    frame={frame}
                    doneIcon={doneIcon}
                    sourcesLabel={labels.sources}
                    sourcesSeparator={sourcesSeparator}
                />
            </div>
        </div>
    );
}
