// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    isVersionSkewError,
    reloadOnVersionSkew,
} from '@/shared/lib/reloadOnVersionSkew';

const { FakeUnrecognizedActionError } = vi.hoisted(() => ({
    FakeUnrecognizedActionError: class extends Error {},
}));

vi.mock('next/navigation', () => ({
    unstable_isUnrecognizedActionError: (error: unknown) =>
        error instanceof FakeUnrecognizedActionError,
}));

describe('reloadOnVersionSkew', () => {
    const reload = vi.fn();

    beforeEach(() => {
        sessionStorage.clear();
        reload.mockClear();
        vi.stubGlobal('location', { ...window.location, reload });
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('reloads once when a Server Action is unknown to the server', () => {
        const error = new FakeUnrecognizedActionError('not found');
        expect(isVersionSkewError(error)).toBe(true);
        expect(reloadOnVersionSkew(error, 1_000_000)).toBe(true);
        expect(reload).toHaveBeenCalledTimes(1);
    });

    it('does not reload again inside the window — a mixed-version rollout must not loop', () => {
        const error = new FakeUnrecognizedActionError('not found');
        reloadOnVersionSkew(error, 1_000_000);
        expect(reloadOnVersionSkew(error, 1_030_000)).toBe(false);
        expect(reloadOnVersionSkew(error, 1_061_000)).toBe(true);
        expect(reload).toHaveBeenCalledTimes(2);
    });

    it('ignores every other error', () => {
        expect(reloadOnVersionSkew(new Error('Failed to fetch'))).toBe(false);
        expect(reloadOnVersionSkew(null)).toBe(false);
        expect(reload).not.toHaveBeenCalled();
    });
});
