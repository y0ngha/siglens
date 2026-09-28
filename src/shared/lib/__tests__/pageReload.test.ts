// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { pageReload } from '../pageReload';

describe('pageReload', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('calls window.location.reload()', () => {
        const reload = vi.fn();
        // window.location is non-configurable under some Vitest pools —
        // stub the reload method rather than reassigning `window.location`.
        vi.stubGlobal('location', { ...window.location, reload });

        pageReload();

        expect(reload).toHaveBeenCalledTimes(1);
    });
});
