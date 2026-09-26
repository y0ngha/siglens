import { describe, it, expect } from 'vitest';
import { tryGetModelAccess, resolveGateAccess } from '../modelAccess';

describe('tryGetModelAccess', () => {
    it('returns the tier for a model registered in TIER_CONFIG', () => {
        // core's FREE_MODELS list — see @y0ngha/siglens-core domain/tier.ts.
        expect(tryGetModelAccess('gpt-5.6-luna')).toBe('free');
    });

    it('returns null instead of throwing for an unregistered model id', () => {
        // core's getModelAccess throws for unknown ids — this wrapper must
        // catch that so a stale localStorage/analysis-history model id
        // doesn't crash the whole model-selection UI.
        expect(tryGetModelAccess('no-such-model-id-xyz' as never)).toBeNull();
    });
});

describe('resolveGateAccess', () => {
    it('mirrors tryGetModelAccess for a known model', () => {
        expect(resolveGateAccess('gpt-5.6-luna')).toBe('free');
    });

    it('falls back to the most restrictive tier (byok) for an unknown model', () => {
        // Failing toward 'byok' locks the model rather than accidentally
        // routing an unknown model through the free server-key path.
        expect(resolveGateAccess('no-such-model-id-xyz' as never)).toBe('byok');
    });
});
