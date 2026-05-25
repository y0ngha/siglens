import {
    CONTACT_CONTENT_MAX_LENGTH,
    CONTACT_TITLE_MAX_LENGTH,
} from '@/shared/config/contact';

describe('CONTACT_TITLE_MAX_LENGTH', () => {
    it('양의 정수이다', () => {
        expect(typeof CONTACT_TITLE_MAX_LENGTH).toBe('number');
        expect(Number.isInteger(CONTACT_TITLE_MAX_LENGTH)).toBe(true);
        expect(CONTACT_TITLE_MAX_LENGTH).toBeGreaterThan(0);
    });

    it('120으로 설정되어 있다', () => {
        expect(CONTACT_TITLE_MAX_LENGTH).toBe(120);
    });
});

describe('CONTACT_CONTENT_MAX_LENGTH', () => {
    it('양의 정수이다', () => {
        expect(typeof CONTACT_CONTENT_MAX_LENGTH).toBe('number');
        expect(Number.isInteger(CONTACT_CONTENT_MAX_LENGTH)).toBe(true);
        expect(CONTACT_CONTENT_MAX_LENGTH).toBeGreaterThan(0);
    });

    it('2000으로 설정되어 있다', () => {
        expect(CONTACT_CONTENT_MAX_LENGTH).toBe(2000);
    });

    it('TITLE보다 크다', () => {
        expect(CONTACT_CONTENT_MAX_LENGTH).toBeGreaterThan(
            CONTACT_TITLE_MAX_LENGTH
        );
    });
});
