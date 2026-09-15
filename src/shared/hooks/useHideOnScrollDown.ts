'use client';

import { useEffect, useState } from 'react';

/** Pixels of travel in one direction before the chrome flips — ignores jitter. */
const SCROLL_DIRECTION_THRESHOLD_PX = 8;
/** Near the top of the page the chrome always shows. */
const ALWAYS_VISIBLE_TOP_PX = 56;
/**
 * How long after the last touch/wheel/key input a scroll still counts as the
 * user's. Covers iOS momentum after the finger lifts (≈1–1.5s).
 */
const USER_SCROLL_WINDOW_MS = 1_500;
const USER_INPUT_EVENTS = [
    'touchstart',
    'touchmove',
    'wheel',
    'keydown',
] as const;

/**
 * `true` while the window is being scrolled down, `false` once it scrolls back up
 * (or sits near the top). Drives "hide the header on the way down, bring it back
 * on the way up" so a phone keeps its height for the conversation but a small
 * upward flick reveals navigation again (2026-09-15 사용자 요청).
 *
 * Window scroll only: the chat transcript grows the page and the composer is
 * `sticky bottom-0`, so the document is what scrolls.
 *
 * Only scrolls that follow user input flip the state. The transcript pins itself
 * to the bottom with `scrollIntoView` on every streamed token, which moves the
 * window too; counting that as "scrolling down" would yank the header away on
 * every answer.
 */
export function useHideOnScrollDown({
    enabled = true,
}: { enabled?: boolean } = {}): boolean {
    const [hidden, setHidden] = useState(false);

    useEffect(() => {
        if (!enabled) {
            setHidden(false);
            return;
        }
        let anchorY = window.scrollY;
        let frame = 0;
        let scheduled = false;
        let lastUserInputAt = Number.NEGATIVE_INFINITY;
        const markUserInput = () => {
            lastUserInputAt = performance.now();
        };
        const evaluate = () => {
            scheduled = false;
            const y = window.scrollY;
            if (y < ALWAYS_VISIBLE_TOP_PX) {
                setHidden(false);
                anchorY = y;
                return;
            }
            if (performance.now() - lastUserInputAt > USER_SCROLL_WINDOW_MS) {
                // Programmatic scroll (auto-pin while streaming): follow it
                // silently so the next user gesture measures from here.
                anchorY = y;
                return;
            }
            const delta = y - anchorY;
            if (Math.abs(delta) < SCROLL_DIRECTION_THRESHOLD_PX) return;
            setHidden(delta > 0);
            anchorY = y;
        };
        const onScroll = () => {
            if (scheduled) return;
            scheduled = true;
            frame = requestAnimationFrame(evaluate);
        };
        for (const type of USER_INPUT_EVENTS)
            window.addEventListener(type, markUserInput, { passive: true });
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => {
            for (const type of USER_INPUT_EVENTS)
                window.removeEventListener(type, markUserInput);
            window.removeEventListener('scroll', onScroll);
            if (scheduled) cancelAnimationFrame(frame);
        };
    }, [enabled]);

    return hidden;
}
