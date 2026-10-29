'use client';

/** Drives a replay `Frame` from React: playback loop, pause, visibility and scroll-follow. */

import { useEffect, useRef, useState, type RefObject } from 'react';
import { useCanAnimate } from '@/shared/hooks/useCanAnimate';
import {
    completeFrame,
    runPlayback,
    type Frame,
    type PlaybackContext,
} from '@/widgets/replay/utils/replayPlayer';
import type { ReplayScenario } from '@/shared/lib/replay/replayScript';

/** What `useReplayPlayback` hands the replay chrome. */
export interface ReplayPlayback {
    readonly frame: Frame;
    readonly paused: boolean;
    readonly togglePaused: () => void;
    /** False on the server, on first render and under reduced motion. */
    readonly animated: boolean;
    /** Attach to the card: playback pauses while it is off screen. */
    readonly rootRef: RefObject<HTMLDivElement | null>;
    /** Attach to the scrolling body: it follows the newest text. */
    readonly threadRef: RefObject<HTMLDivElement | null>;
}

/**
 * React side of `replayPlayer`, shared by `ChatReplay` (ai.siglens.io/about)
 * and `ReportReplay` (siglens.io/about).
 *
 * SSR and the first client render show the first scenario complete, so
 * crawlers and a no-JS reader get a whole example and hydration matches.
 * Playback starts after mount unless the reader prefers reduced motion. It
 * pauses while the card is off screen or `togglePaused` was pressed — motion
 * that runs on its own for more than five seconds needs a stop control
 * (WCAG 2.2.2).
 *
 * Whenever playback stops (reduced motion switched on mid-scenario, new
 * scenarios, unmount) the frame snaps to the current scenario complete, so a
 * reader is never left with a half-typed question and no control to finish it.
 */
export function useReplayPlayback(
    scenarios: readonly ReplayScenario[]
): ReplayPlayback {
    const [frame, setFrame] = useState<Frame>(() => completeFrame(0));
    const [paused, setPaused] = useState(false);
    const pausedRef = useRef(false);
    const visibleRef = useRef(true);
    const rootRef = useRef<HTMLDivElement>(null);
    const threadRef = useRef<HTMLDivElement>(null);
    const animated = useCanAnimate();

    const togglePaused = () => setPaused(p => !p);

    useEffect(() => {
        pausedRef.current = paused;
    }, [paused]);

    useEffect(() => {
        const root = rootRef.current;
        if (!root || typeof IntersectionObserver === 'undefined') return;
        // One callback can carry several entries for the card when it crosses
        // the viewport edge more than once between notifications; they arrive
        // oldest first, so the last one is the current state.
        const observer = new IntersectionObserver(entries => {
            visibleRef.current = entries.at(-1)?.isIntersecting ?? true;
        });
        observer.observe(root);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!animated) return;
        let cancelled = false;
        let pendingTimer: ReturnType<typeof setTimeout> | undefined;
        const ctx: PlaybackContext = {
            scenarios,
            setFrame,
            isCancelled: () => cancelled,
            isRunning: () => !pausedRef.current && visibleRef.current,
            setPendingTimer: id => {
                pendingTimer = id;
            },
            random: Math.random,
        };

        void runPlayback(ctx);

        return () => {
            cancelled = true;
            clearTimeout(pendingTimer);
            setFrame(current => completeFrame(current.index));
        };
    }, [animated, scenarios]);

    // Keep the newest text in view once the body outgrows the fixed card.
    useEffect(() => {
        const thread = threadRef.current;
        if (thread) thread.scrollTop = thread.scrollHeight;
    }, [frame]);

    return {
        frame,
        paused,
        togglePaused,
        animated,
        rootRef,
        threadRef,
    };
}
