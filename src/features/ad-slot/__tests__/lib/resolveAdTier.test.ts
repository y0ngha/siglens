import { resolveAdTier } from '@/features/ad-slot/lib/resolveAdTier';

describe('resolveAdTier', () => {
    it('waits while the current user is still loading', () => {
        expect(resolveAdTier({ isPending: true, user: undefined })).toBe(
            'pending'
        );
    });

    it('shows ads to guests', () => {
        expect(resolveAdTier({ isPending: false, user: null })).toBe('show');
    });

    it('treats a failed lookup like a guest', () => {
        expect(resolveAdTier({ isPending: false, user: undefined })).toBe(
            'show'
        );
    });

    it.each(['free', 'member'])('shows ads to %s members', tier => {
        expect(resolveAdTier({ isPending: false, user: { tier } })).toBe(
            'show'
        );
    });

    it('hides ads from pro members', () => {
        expect(resolveAdTier({ isPending: false, user: { tier: 'pro' } })).toBe(
            'hide'
        );
    });
});
