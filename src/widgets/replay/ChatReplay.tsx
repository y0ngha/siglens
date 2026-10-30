'use client';

/** The auto-playing example conversation on ai.siglens.io `/about` and the `/lp` chat landing. */

import type { ReactNode } from 'react';
import type { ReplayScenario } from '@/shared/lib/replay/replayScript';
import { SURFACE_CARD, SURFACE_NESTED } from '@/shared/lib/surfaceStyles';
import { useCurrentLocale } from '@/shared/i18n/LocaleContext';
import { brandAiName } from '@/shared/lib/brandName';
import { cn } from '@/shared/lib/cn';
import { useReplayPlayback } from '@/widgets/replay/hooks/useReplayPlayback';
import { deriveReplayView } from '@/widgets/replay/utils/replayView';
import { ReplayAnswer } from '@/widgets/replay/ui/body/ReplayAnswer';
import { ReplayCaret } from '@/widgets/replay/ui/body/ReplayCaret';
import { ReplayPauseButton } from '@/widgets/replay/ui/controls/ReplayPauseButton';

interface ChatReplayLabels {
    readonly region: string;
    readonly pause: string;
    readonly resume: string;
    readonly sources: string;
}

interface Props {
    readonly scenarios: readonly ReplayScenario[];
    readonly labels: ChatReplayLabels;
    /**
     * Rendered on the server and handed down as elements: importing
     * `widgets/agent-chat` modules into this client module would drag the whole
     * chat shell into the /about bundle.
     */
    readonly avatar: ReactNode;
    readonly doneIcon: ReactNode;
    /**
     * The `|` divider before the as-of time in the sources line. The ad
     * landings (`/lp`) turn it off: their copy carries no divider symbols.
     */
    readonly sourcesSeparator?: boolean;
}

/**
 * The auto-playing example conversation on `/about`: the question types
 * itself into the user bubble, lookups light up one by one and fold into a
 * summary line, then the answer streams in with its sources.
 *
 * Playback, SSR and pause rules live in `useReplayPlayback`; the steps, body
 * and sources are `ReplayAnswer`. This component only owns the chat chrome
 * (the SIGLENS AI header, the user bubble, the avatar).
 */
export function ChatReplay({
    scenarios,
    labels,
    avatar,
    doneIcon,
    sourcesSeparator = true,
}: Props) {
    const locale = useCurrentLocale();
    const { frame, paused, togglePaused, animated, rootRef, threadRef } =
        useReplayPlayback(scenarios);

    const view = deriveReplayView(scenarios, frame);

    return (
        <div
            ref={rootRef}
            role="region"
            aria-label={labels.region}
            className={cn(
                SURFACE_CARD,
                'mx-auto flex w-full max-w-3xl flex-col overflow-hidden'
            )}
        >
            <div className="flex min-h-12 items-center justify-between gap-2 border-b border-secondary-700 px-4 text-xs text-secondary-400">
                <span className="inline-flex items-center gap-2 font-mono tracking-wider">
                    <span
                        aria-hidden="true"
                        className="size-1.5 rounded-full bg-ui-success"
                    />
                    <span translate="no">{brandAiName(locale)}</span>
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
                {view.typedQuestion ? (
                    <div
                        className={cn(
                            // Inside the replay frame (SURFACE_CARD): the same surface again would bury the bubble.
                            SURFACE_NESTED,
                            'max-w-[85%] self-end px-4 py-2.5 text-[15px] leading-6 break-words text-secondary-100'
                        )}
                    >
                        {view.typedQuestion}
                        {view.typing ? <ReplayCaret /> : null}
                    </div>
                ) : null}
                {view.answerStarted ? (
                    <div className="flex items-start gap-3">
                        {avatar}
                        <div className="flex min-w-0 flex-1 flex-col gap-2.5 text-[15px] leading-7 text-secondary-200">
                            <ReplayAnswer
                                view={view}
                                frame={frame}
                                doneIcon={doneIcon}
                                sourcesLabel={labels.sources}
                                sourcesSeparator={sourcesSeparator}
                            />
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
