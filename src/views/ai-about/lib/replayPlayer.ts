/**
 * Playback engine for the `/about` chat replay: a module-level state machine
 * (`runPlayback` → `playScenario` → `waitPlaying`) that takes an explicit
 * `PlaybackContext` instead of closing over component state, so it can run
 * outside React and be unit-tested with fake timers (MISTAKES.md #14.5).
 *
 * `ChatReplay` only builds the context (refs, `setFrame`, cancellation) and
 * calls `runPlayback` from a `useEffect`; every timing decision lives here.
 */

import { lineLength, pickNextIndex, type ReplayScenario } from './replayScript';

/** What is on screen at one instant of the replay. */
export interface Frame {
    readonly index: number;
    readonly typed: number;
    readonly toolsShown: number;
    readonly toolsDone: number;
    readonly summary: boolean;
    readonly chars: number;
    readonly sources: boolean;
}

const COMPLETE = Number.MAX_SAFE_INTEGER;
export const completeFrame = (index: number): Frame => ({
    index,
    typed: COMPLETE,
    toolsShown: COMPLETE,
    toolsDone: COMPLETE,
    summary: true,
    chars: COMPLETE,
    sources: true,
});

/** Delay before the first question starts typing after mount. */
export const FIRST_START_MS = 300;
/** Delay before each following scenario starts typing. */
export const NEXT_START_MS = 900;
/** Delay between the question finishing and the first tool lighting up. */
export const AFTER_TYPING_MS = 350;
/** Delay between one tool finishing and the next one starting. */
export const TOOL_GAP_MS = 120;
/** Delay between the last tool finishing and the answer starting to stream. */
export const BEFORE_ANSWER_MS = 350;
/** Per-character typing speed for the question bubble, jittered ±40%. */
export const TYPE_MS = 38;
/** Characters revealed per answer-streaming tick. */
export const STREAM_STEP = 3;
/** Delay per answer-streaming tick. */
export const STREAM_MS = 28;
/** How long the finished answer stays on screen before the next scenario. */
export const HOLD_MS = 5200;
/** Poll interval `waitPlaying` uses to notice pause/visibility changes. */
export const TICK_MS = 40;

export interface PlaybackContext {
    readonly scenarios: readonly ReplayScenario[];
    readonly setFrame: (frame: Frame) => void;
    readonly isCancelled: () => boolean;
    /** `!paused && visible` — whether playback time should advance right now. */
    readonly isRunning: () => boolean;
    readonly addTimer: (id: ReturnType<typeof setTimeout>) => void;
    readonly random: () => number;
}

/**
 * Resolves after `ms` of *playing* time (paused/off-screen time doesn't
 * count), or rejects once `ctx.isCancelled()` — the caller (`playScenario`,
 * `runPlayback`) never has to poll cancellation itself.
 */
export function waitPlaying(ctx: PlaybackContext, ms: number): Promise<void> {
    return new Promise((resolve, reject) => {
        let left = ms;
        let last = Date.now();
        const tick = () => {
            if (ctx.isCancelled()) return reject(new Error('cancelled'));
            const now = Date.now();
            if (ctx.isRunning()) left -= now - last;
            last = now;
            if (left <= 0) return resolve();
            const id = setTimeout(tick, Math.min(left, TICK_MS));
            ctx.addTimer(id);
        };
        tick();
    });
}

/** Plays one scenario end to end: typing, tool lookups, answer stream, hold. */
export async function playScenario(
    ctx: PlaybackContext,
    index: number,
    firstRun: boolean
): Promise<void> {
    const scenario = ctx.scenarios[index]!;
    const base: Frame = {
        index,
        typed: 0,
        toolsShown: 0,
        toolsDone: 0,
        summary: false,
        chars: 0,
        sources: false,
    };
    await waitPlaying(ctx, firstRun ? FIRST_START_MS : NEXT_START_MS);
    ctx.setFrame(base);
    for (let i = 1; i <= scenario.question.length; i++) {
        ctx.setFrame({ ...base, typed: i });
        await waitPlaying(ctx, TYPE_MS * (0.6 + ctx.random() * 0.8));
    }
    await waitPlaying(ctx, AFTER_TYPING_MS);
    const typed = scenario.question.length;
    for (let t = 0; t < scenario.tools.length; t++) {
        ctx.setFrame({ ...base, typed, toolsShown: t + 1, toolsDone: t });
        await waitPlaying(ctx, scenario.tools[t]!.ms);
        ctx.setFrame({ ...base, typed, toolsShown: t + 1, toolsDone: t + 1 });
        await waitPlaying(ctx, TOOL_GAP_MS);
    }
    await waitPlaying(ctx, BEFORE_ANSWER_MS);
    const total = scenario.lines.reduce(
        (sum, line) => sum + lineLength(line),
        0
    );
    for (let c = 0; c <= total; c += STREAM_STEP) {
        ctx.setFrame({ ...base, typed, summary: true, chars: c });
        await waitPlaying(ctx, STREAM_MS);
    }
    ctx.setFrame(completeFrame(index));
    await waitPlaying(ctx, HOLD_MS);
}

/**
 * The endless loop: play a random scenario, then keep playing a different
 * random one forever. Swallows the rejection `waitPlaying` throws once
 * cancelled — that's the effect cleanup unmounting, not an error.
 */
export async function runPlayback(ctx: PlaybackContext): Promise<void> {
    let index = Math.floor(ctx.random() * ctx.scenarios.length);
    let firstRun = true;
    try {
        while (!ctx.isCancelled()) {
            await playScenario(ctx, index, firstRun);
            firstRun = false;
            index = pickNextIndex(ctx.scenarios.length, index, ctx.random);
        }
    } catch {
        // cancelled on unmount
    }
}
