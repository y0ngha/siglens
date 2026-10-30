import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    cancelFrame,
    scheduleFrame,
} from '@/features/agent-chat/lib/frameScheduler';

afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe('scheduleFrame', () => {
    it('uses requestAnimationFrame when the environment has it', () => {
        const raf = vi.fn(() => 7);
        vi.stubGlobal('requestAnimationFrame', raf);
        expect(scheduleFrame(() => {})).toEqual({ kind: 'raf', id: 7 });
    });

    it('falls back to a timer that runs the callback without requestAnimationFrame', () => {
        vi.useFakeTimers();
        vi.stubGlobal('requestAnimationFrame', undefined);
        const callback = vi.fn();
        scheduleFrame(callback);
        vi.advanceTimersByTime(16);
        expect(callback).toHaveBeenCalledTimes(1);
    });
});

describe('cancelFrame', () => {
    it('cancels an animation-frame handle with cancelAnimationFrame', () => {
        const caf = vi.fn();
        vi.stubGlobal('cancelAnimationFrame', caf);
        cancelFrame({ kind: 'raf', id: 7 });
        expect(caf).toHaveBeenCalledWith(7);
    });

    it('cancels a timer handle so the callback never runs', () => {
        vi.useFakeTimers();
        vi.stubGlobal('requestAnimationFrame', undefined);
        const callback = vi.fn();
        cancelFrame(scheduleFrame(callback));
        vi.advanceTimersByTime(16);
        expect(callback).not.toHaveBeenCalled();
    });
});
