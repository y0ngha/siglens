import { TIER_LABEL } from '@/shared/lib/auth/tierLabel';
import type { Tier } from '@y0ngha/siglens-core';

const ALL_TIERS: Tier[] = ['free', 'member', 'pro'];

describe('TIER_LABEL', () => {
    it('has a label for every Tier', () => {
        for (const tier of ALL_TIERS) {
            expect(TIER_LABEL[tier]).toBeDefined();
            expect(typeof TIER_LABEL[tier]).toBe('string');
            expect(TIER_LABEL[tier].length).toBeGreaterThan(0);
        }
    });

    it('has exactly as many entries as ALL_TIERS', () => {
        expect(Object.keys(TIER_LABEL)).toHaveLength(ALL_TIERS.length);
    });

    it('free tier is labeled "Free"', () => {
        expect(TIER_LABEL.free).toBe('Free');
    });

    it('member tier is labeled "Member"', () => {
        expect(TIER_LABEL.member).toBe('Member');
    });

    it('pro tier is labeled "Pro"', () => {
        expect(TIER_LABEL.pro).toBe('Pro');
    });
});
