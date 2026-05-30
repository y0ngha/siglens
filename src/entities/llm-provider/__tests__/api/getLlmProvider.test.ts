import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock both branch targets with sentinel functions so we can assert which one
// getLlmProvider returns by reference identity (the real implementations call
// SDKs / read env, irrelevant to the branch-selection logic under test).
vi.mock('../../api/router', () => ({
    callAiProviderRouter: vi.fn(),
}));
vi.mock('../../api/FakeChatProvider', () => ({
    fakeCallAiProvider: vi.fn(),
}));

import { getLlmProvider } from '../../api/getLlmProvider';
import { callAiProviderRouter } from '../../api/router';
import { fakeCallAiProvider } from '../../api/FakeChatProvider';

describe('getLlmProvider', () => {
    const originalE2E = process.env.E2E_TEST;

    beforeEach(() => {
        delete process.env.E2E_TEST;
    });

    afterEach(() => {
        if (originalE2E === undefined) {
            delete process.env.E2E_TEST;
        } else {
            process.env.E2E_TEST = originalE2E;
        }
    });

    it('returns the fake provider when E2E_TEST=1', () => {
        process.env.E2E_TEST = '1';
        expect(getLlmProvider()).toBe(fakeCallAiProvider);
    });

    it('returns the real router when E2E_TEST is unset', () => {
        expect(getLlmProvider()).toBe(callAiProviderRouter);
    });

    it('returns the real router when E2E_TEST is set to a non-"1" value', () => {
        process.env.E2E_TEST = '0';
        expect(getLlmProvider()).toBe(callAiProviderRouter);
    });
});
