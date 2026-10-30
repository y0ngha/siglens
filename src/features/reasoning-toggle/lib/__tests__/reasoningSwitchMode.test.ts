import { getReasoningSwitchMode } from '@/features/reasoning-toggle/lib/reasoningSwitchMode';

describe('getReasoningSwitchMode', () => {
    it('returns interactive for a member when not disabled', () => {
        expect(getReasoningSwitchMode({ canUse: true, disabled: false })).toBe(
            'interactive'
        );
    });

    it('returns locked for a non-member when not disabled', () => {
        expect(getReasoningSwitchMode({ canUse: false, disabled: false })).toBe(
            'locked'
        );
    });

    it('returns disabled whenever disabled, even for a non-member', () => {
        expect(getReasoningSwitchMode({ canUse: true, disabled: true })).toBe(
            'disabled'
        );
        expect(getReasoningSwitchMode({ canUse: false, disabled: true })).toBe(
            'disabled'
        );
    });
});
