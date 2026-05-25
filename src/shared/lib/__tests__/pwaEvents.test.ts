import { PWA_TRIGGER_EVENT } from '@/shared/lib/pwaEvents';

describe('PWA_TRIGGER_EVENT', () => {
    it('is the expected event name', () => {
        expect(PWA_TRIGGER_EVENT).toBe('siglens:pwa-trigger');
    });

    it('uses the siglens namespace prefix', () => {
        expect(PWA_TRIGGER_EVENT).toMatch(/^siglens:/);
    });
});
