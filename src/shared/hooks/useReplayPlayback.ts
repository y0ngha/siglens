'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { useCanAnimate } from '@/shared/hooks/useCanAnimate';
import {
    completeFrame,
    runPlayback,
    type Frame,
    type PlaybackContext,
} from '@/shared/lib/replay/replayPlayer';
import type { ReplayScenario } from '@/shared/lib/replay/replayScript';

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

    // Keep the newest text in view once the body outgrows the fixed card.
    useEffect(() => {
        const thread = threadRef.current;
        if (thread) thread.scrollTop = thread.scrollHeight;
    }, [frame]);

    return {
        frame,
        paused,
        togglePaused: () => setPaused(p => !p),
        animated,
        rootRef,
        threadRef,
    };
}
