import { CARD_LINK_CLASSES } from '@/shared/lib/cardStyles';

describe('CARD_LINK_CLASSES', () => {
    it('is a non-empty string', () => {
        expect(typeof CARD_LINK_CLASSES).toBe('string');
        expect(CARD_LINK_CLASSES.length).toBeGreaterThan(0);
    });

    it('includes rounded-lg for card shape', () => {
        expect(CARD_LINK_CLASSES).toContain('rounded-lg');
    });

    it('includes touch-manipulation for mobile optimization', () => {
        expect(CARD_LINK_CLASSES).toContain('touch-manipulation');
    });

    it('includes hover styles', () => {
        expect(CARD_LINK_CLASSES).toMatch(/hover:/);
    });

    it('includes focus-visible ring styles', () => {
        expect(CARD_LINK_CLASSES).toMatch(/focus-visible:ring/);
    });

    it('includes motion-reduce styles', () => {
        expect(CARD_LINK_CLASSES).toMatch(/motion-reduce:/);
    });

    it('includes transition duration', () => {
        expect(CARD_LINK_CLASSES).toContain('duration-150');
    });
});
