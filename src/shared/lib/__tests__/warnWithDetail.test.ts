import { afterEach, describe, expect, it, vi } from 'vitest';
import { warnWithDetail } from '../warnWithDetail';

describe('warnWithDetail', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('logs only the message when there is no detail (no trailing undefined)', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        warnWithDetail('[finra-short] empty universe');
        expect(warn).toHaveBeenCalledWith('[finra-short] empty universe');
        expect(warn.mock.calls.every(call => call.length === 1)).toBe(true);
    });

    it('passes a detail through as the second argument', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        warnWithDetail('[cusip-map] profile failed AAA:', 'boom');
        expect(warn).toHaveBeenCalledWith(
            '[cusip-map] profile failed AAA:',
            'boom'
        );
    });

    it('keeps falsy details such as 0 and an empty string', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        warnWithDetail('count', 0);
        expect(warn).toHaveBeenCalledWith('count', 0);
    });
});
