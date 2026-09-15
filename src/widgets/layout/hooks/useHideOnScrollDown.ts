'use client';

import { useSyncExternalStore } from 'react';

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
 * Matches the `lg` breakpoint the callers already hide their chrome at
 * (`Header.tsx`'s `max-lg:-translate-y-full`, `ChatShell.tsx`'s `lg:hidden`
 * bar). Callers apply `inert` to the whole element when this hook reports
 * `true`, and `inert` cannot be scoped to a media query the way those
 * translate/display classes are — so the hook itself must never report
 * "hidden" on a viewport where the CSS keeps the chrome pinned in place.
 * Without this, a desktop user scrolling down on the ai host would get a
 * header that still looks fully visible but is silently non-interactive.
 *
 * Not `MOBILE_VIEWPORT_MEDIA_QUERY` (`shared/config/viewport.ts`) — that one
 * is the Tailwind `md` (768px) boundary used elsewhere; this hook needs `lg`
 * (1024px) to match the breakpoint its own callers hide at.
 */
const BELOW_LG_MEDIA_QUERY = '(max-width: 1023.98px)';

interface ScrollChromeState {
    readonly hidden: boolean;
    readonly belowLg: boolean;
}

const INITIAL_STATE: ScrollChromeState = { hidden: false, belowLg: false };

let state: ScrollChromeState = INITIAL_STATE;
const listeners = new Set<() => void>();
let stopListening: (() => void) | null = null;

function update(next: Partial<ScrollChromeState>): void {
    const merged = { ...state, ...next };
    if (merged.hidden === state.hidden && merged.belowLg === state.belowLg)
        return;
    state = merged;
    for (const listener of listeners) listener();
}

/** Attaches the window listeners once, for all subscribers. */
function startListening(): () => void {
    const mediaQueryList = window.matchMedia(BELOW_LG_MEDIA_QUERY);
    const syncBreakpoint = () => update({ belowLg: mediaQueryList.matches });
    syncBreakpoint();
    mediaQueryList.addEventListener('change', syncBreakpoint);

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
            update({ hidden: false });
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
        // `inert` blurs focus when it lands on the element it's applied to.
        // Hiding while the user is mid-interaction with a control inside the
        // chrome (the drawer trigger, a header link) would yank focus away
        // under them — so a downward scroll only hides while focus is
        // elsewhere.
        if (
            delta > 0 &&
            document.activeElement?.closest('[data-scroll-chrome]')
        )
            return;
        update({ hidden: delta > 0 });
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
        mediaQueryList.removeEventListener('change', syncBreakpoint);
        for (const type of USER_INPUT_EVENTS)
            window.removeEventListener(type, markUserInput);
        window.removeEventListener('scroll', onScroll);
        if (scheduled) cancelAnimationFrame(frame);
    };
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    stopListening ??= startListening();
    return () => {
        listeners.delete(listener);
        if (listeners.size > 0 || stopListening === null) return;
        stopListening();
        stopListening = null;
        state = INITIAL_STATE;
    };
}

// Ignores its listener: a disabled caller never subscribes to the window.
const subscribeNothing =
    (_onStoreChange: () => void): (() => void) =>
    () => {};
const getSnapshot = (): ScrollChromeState => state;
const getServerSnapshot = (): ScrollChromeState => INITIAL_STATE;

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
 *
 * Always `false` at `lg` and above — see `BELOW_LG_MEDIA_QUERY`.
 *
 * **One shared state for every caller.** The site header (in the ai layout) and
 * ChatShell's conversation bar must move together, but they mount at different
 * times: ChatShell remounts on every conversation switch while the header stays.
 * With per-instance state the new bar started "shown" under a header that was
 * still "hidden" — the bar floated over the transcript with nothing above it
 * (2026-09-15 사용자 제보, mid-scroll conversation switch). A module-level store
 * read through `useSyncExternalStore` gives a late subscriber the current value.
 */
export function useHideOnScrollDown({
    enabled = true,
}: { enabled?: boolean } = {}): boolean {
    const { hidden, belowLg } = useSyncExternalStore(
        // A disabled caller (the main-host header) attaches no listeners.
        enabled ? subscribe : subscribeNothing,
        enabled ? getSnapshot : getServerSnapshot,
        getServerSnapshot
    );
    return enabled && hidden && belowLg;
}
