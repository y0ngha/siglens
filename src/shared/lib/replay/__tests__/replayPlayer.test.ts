import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseReplayLine, type ReplayScenario } from '../replayScript';
import {
    completeFrame,
    playScenario,
    runPlayback,
    waitPlaying,
    type Frame,
    type PlaybackContext,
} from '../replayPlayer';

function makeScenario(id: string, question: string): ReplayScenario {
    return {
        id,
        question,
        tools: [
            {
                label: 'Quote',
                pendingLabel: 'Checking quote',
                subject: 'AAA',
                ms: 50,
            },
        ],
        lines: [parseReplayLine('p', 'abcde')],
        summary: 'Quote checked',
        sources: ['Quote'],
        asOf: 'as of close',
    };
}

/** Records every `setFrame` call in order, so assertions can `find`/`filter` by predicate. */
function makeContext(
    scenarios: readonly ReplayScenario[],
    overrides: Partial<PlaybackContext> = {}
): { ctx: PlaybackContext; frames: Frame[] } {
    const frames: Frame[] = [];
    const ctx: PlaybackContext = {
        scenarios,
        setFrame: f => {
            frames.push(f);
        },
        isCancelled: () => false,
        isRunning: () => true,
        addTimer: () => {},
        random: () => 0,
        ...overrides,
    };
    return { ctx, frames };
}

describe('replayPlayer', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    describe('waitPlaying', () => {
        it('does not advance while isRunning() is false, and resolves after ms once playing', async () => {
            let running = false;
            let resolved = false;
            const ctx: PlaybackContext = {
                scenarios: [],
                setFrame: () => {},
                isCancelled: () => false,
                isRunning: () => running,
                addTimer: () => {},
                random: () => 0,
            };
            void waitPlaying(ctx, 100).then(() => {
                resolved = true;
            });

            await vi.advanceTimersByTimeAsync(500);
            expect(resolved).toBe(false);

            running = true;
            await vi.advanceTimersByTimeAsync(150);
            expect(resolved).toBe(true);
        });
    });

    describe('playScenario', () => {
        it('emits frames in order: typing, tool pending/done, summary streaming, then complete', async () => {
            const scenario = makeScenario('x', 'Hi?');
            const { ctx, frames } = makeContext([scenario]);

            const done = playScenario(ctx, 0, true);
            await vi.runAllTimersAsync();
            await done;

            const typedFrames = frames.filter(
                f => f.toolsShown === 0 && !f.summary && f.typed > 0
            );
            expect(typedFrames.map(f => f.typed)).toEqual([1, 2, 3]);

            const pending = frames.find(
                f => f.toolsShown === 1 && f.toolsDone === 0
            );
            expect(pending).toMatchObject({ typed: 3 });

            const toolDone = frames.find(
                f => f.toolsShown === 1 && f.toolsDone === 1 && !f.summary
            );
            expect(toolDone).toMatchObject({ typed: 3 });

            const summaryFrames = frames.filter(
                f => f.summary && f.chars < Number.MAX_SAFE_INTEGER
            );
            expect(summaryFrames.length).toBeGreaterThan(0);
            expect(summaryFrames[0]!.chars).toBe(0);
            expect(summaryFrames.at(-1)!.chars).toBeGreaterThan(0);
            const chars = summaryFrames.map(f => f.chars);
            expect(chars).toEqual([...chars].sort((a, b) => a - b));

            expect(frames.at(-1)).toEqual(completeFrame(0));
        });
    });

    describe('runPlayback', () => {
        it('stops without further setFrame calls once cancelled, and resolves rather than throwing', async () => {
            const scenarios = [
                makeScenario('x', 'Hi?'),
                makeScenario('y', 'Yo?'),
            ];
            let cancelled = false;
            const { ctx, frames } = makeContext(scenarios, {
                isCancelled: () => cancelled,
            });

            const run = runPlayback(ctx);
            // Past the first scenario's start delay, so at least one frame landed.
            await vi.advanceTimersByTimeAsync(400);
            expect(frames.length).toBeGreaterThan(0);

            cancelled = true;
            const countAtCancel = frames.length;
            await vi.runAllTimersAsync();
            await expect(run).resolves.toBeUndefined();

            expect(frames.length).toBe(countAtCancel);
        });

        it('logs and resolves (does not throw) when setFrame throws a non-cancel error, but stays silent on cancellation', async () => {
            const errorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            const scenarios = [makeScenario('x', 'Hi?')];
            const { ctx } = makeContext(scenarios, {
                setFrame: () => {
                    throw new Error('boom');
                },
            });

            const run = runPlayback(ctx);
            await vi.runAllTimersAsync();
            await expect(run).resolves.toBeUndefined();
            expect(errorSpy).toHaveBeenCalledWith(
                '[replay] playback stopped:',
                expect.any(Error)
            );

            errorSpy.mockClear();

            let cancelled = false;
            const { ctx: cancelCtx } = makeContext(scenarios, {
                isCancelled: () => cancelled,
            });
            const cancelRun = runPlayback(cancelCtx);
            await vi.advanceTimersByTimeAsync(50);
            cancelled = true;
            await vi.runAllTimersAsync();
            await expect(cancelRun).resolves.toBeUndefined();
            expect(errorSpy).not.toHaveBeenCalled();

            errorSpy.mockRestore();
        });
    });
});
