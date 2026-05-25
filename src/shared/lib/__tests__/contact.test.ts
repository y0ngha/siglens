import { CONTACT_EMAIL } from '@/shared/lib/contact';

describe('CONTACT_EMAIL', () => {
    it('is the expected email address', () => {
        expect(CONTACT_EMAIL).toBe('stock.siglens@gmail.com');
    });

    it('is a valid email format', () => {
        expect(CONTACT_EMAIL).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    });
});
