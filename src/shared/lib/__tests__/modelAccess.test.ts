import { describe, it, expect } from 'vitest';
import { tryGetModelAccess, resolveGateAccess } from '../modelAccess';

describe('tryGetModelAccess', () => {
    it('returns the tier for a model registered in TIER_CONFIG', () => {
        // core's FREE_MODELS list — see @y0ngha/siglens-core domain/tier.ts.
        expect(tryGetModelAccess('gpt-6-luna')).toBe('free');
    });

    it('returns null instead of throwing for an unregistered model id', () => {
        // core's getModelAccess throws for unknown ids — this wrapper must
        // catch that so a stale localStorage/analysis-history model id
        // doesn't crash the whole model-selection UI.
        expect(tryGetModelAccess('no-such-model-id-xyz' as never)).toBeNull();
    });
});

describe('2026-11 roster classes', () => {
    it.each([
        'claude-fable-5-2',
        'gpt-6.2-sol',
        'gpt-6.2-astra',
        'gemini-4-carbon',
        'gemini-4-neon',
        'gemini-4-hydrogen',
    ] as const)('%s needs the user own key (byok)', id => {
        expect(tryGetModelAccess(id)).toBe('byok');
    });

    it.each([
        ['gemini-3.5-flash-lite', 'free'],
        ['gemini-3.6-flash', 'free'],
        ['claude-haiku-5-5', 'free'],
        ['gpt-6-luna', 'free'],
        ['gemini-3.8-flash', 'member'],
        ['gemini-3.1-pro-preview', 'member'],
        ['claude-sonnet-5-5', 'member'],
        ['gpt-6-sol', 'member'],
    ] as const)('keeps %s in the %s class', (id, access) => {
        expect(tryGetModelAccess(id)).toBe(access);
    });
});

describe('resolveGateAccess', () => {
    it('mirrors tryGetModelAccess for a known model', () => {
        expect(resolveGateAccess('gpt-6-luna')).toBe('free');
    });

    it('falls back to the most restrictive tier (byok) for an unknown model', () => {
        // Failing toward 'byok' locks the model rather than accidentally
        // routing an unknown model through the free server-key path.
        expect(resolveGateAccess('no-such-model-id-xyz' as never)).toBe('byok');
    });
});
