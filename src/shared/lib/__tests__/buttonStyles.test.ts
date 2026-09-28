import {
    BUTTON_DANGER,
    BUTTON_GHOST,
    BUTTON_OUTLINE,
    BUTTON_OUTLINE_DANGER,
    BUTTON_PRIMARY,
} from '@/shared/lib/buttonStyles';

const ALL = {
    BUTTON_PRIMARY,
    BUTTON_DANGER,
    BUTTON_OUTLINE,
    BUTTON_OUTLINE_DANGER,
    BUTTON_GHOST,
};

describe('buttonStyles', () => {
    it.each(Object.entries(ALL))(
        '%s carries a 2px focus ring, reduced-motion and a non-opacity disabled state',
        (_, classes) => {
            expect(classes).toContain('focus-visible:ring-2');
            expect(classes).toContain('motion-reduce:transition-none');
            expect(classes).toContain('disabled:cursor-not-allowed');
            expect(classes).not.toMatch(/disabled:opacity-/);
        }
    );

    it('darkens the primary fill on hover (hover:bg-primary-500 drops white-text contrast)', () => {
        expect(BUTTON_PRIMARY).toContain('hover:bg-primary-700');
        expect(BUTTON_PRIMARY).not.toContain('hover:bg-primary-500');
    });

    it('draws outline borders with opaque control-contrast tokens', () => {
        expect(BUTTON_OUTLINE).toContain('border-border-control');
        expect(BUTTON_OUTLINE_DANGER).toMatch(/(^| )border-ui-danger( |$)/);
    });
});
