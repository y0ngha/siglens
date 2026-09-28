// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { assignLocation, replaceLocation } from '../crossHostNavigate';

describe('crossHostNavigate', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('assignLocation calls window.location.assign(url) (keeps a history entry)', () => {
        const assign = vi.fn();
        // window.location is non-configurable under some Vitest pools —
        // stub the assign/replace methods rather than reassigning `window.location`.
        vi.stubGlobal('location', { ...window.location, assign });

        assignLocation('https://siglens.io/en');

        expect(assign).toHaveBeenCalledWith('https://siglens.io/en');
        expect(assign).toHaveBeenCalledTimes(1);
    });

    it('replaceLocation calls window.location.replace(url) (no history entry)', () => {
        const replace = vi.fn();
        vi.stubGlobal('location', { ...window.location, replace });

        replaceLocation('https://ai.siglens.io/en');

        expect(replace).toHaveBeenCalledWith('https://ai.siglens.io/en');
        expect(replace).toHaveBeenCalledTimes(1);
    });
});
