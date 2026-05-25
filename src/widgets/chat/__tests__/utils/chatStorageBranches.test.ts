/**
 * Branch coverage for chatStorage — targets uncovered:
 * - L20: loadSessionFull when window is undefined (SSR)
 * - L36: saveSession when window is undefined (SSR)
 */

import { loadSessionFull, saveSession } from '@/widgets/chat/utils/chatStorage';

describe('chatStorage — SSR branches', () => {
    const originalWindow = globalThis.window;

    afterEach(() => {
        // Restore window
        Object.defineProperty(globalThis, 'window', {
            value: originalWindow,
            configurable: true,
            writable: true,
        });
    });

    it('loadSessionFull returns empty when window is undefined', () => {
        Object.defineProperty(globalThis, 'window', {
            value: undefined,
            configurable: true,
            writable: true,
        });

        const result = loadSessionFull('test-key');
        expect(result).toEqual({ messages: [], savedAt: null });
    });

    it('saveSession does nothing when window is undefined', () => {
        Object.defineProperty(globalThis, 'window', {
            value: undefined,
            configurable: true,
            writable: true,
        });

        // Should not throw
        saveSession('test-key', []);
    });
});
