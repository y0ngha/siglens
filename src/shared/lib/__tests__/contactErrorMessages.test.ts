import { CONTACT_ERROR_MESSAGES } from '@/shared/lib/contactErrorMessages';
import {
    CONTACT_TITLE_MAX_LENGTH,
    CONTACT_CONTENT_MAX_LENGTH,
} from '@/shared/config/contact';
import type { ContactFormErrorCode } from '@/shared/lib/types';

const ALL_ERROR_CODES: ContactFormErrorCode[] = [
    'title_required',
    'title_too_long',
    'email_required',
    'email_invalid',
    'content_required',
    'content_too_long',
    'submission_failed',
];

describe('CONTACT_ERROR_MESSAGES', () => {
    it('has a message for every ContactFormErrorCode', () => {
        for (const code of ALL_ERROR_CODES) {
            expect(CONTACT_ERROR_MESSAGES[code]).toBeDefined();
            expect(typeof CONTACT_ERROR_MESSAGES[code]).toBe('string');
            expect(CONTACT_ERROR_MESSAGES[code].length).toBeGreaterThan(0);
        }
    });

    it('has exactly the right number of entries', () => {
        expect(Object.keys(CONTACT_ERROR_MESSAGES)).toHaveLength(
            ALL_ERROR_CODES.length
        );
    });

    it('title_too_long message includes the max length', () => {
        expect(CONTACT_ERROR_MESSAGES.title_too_long).toContain(
            String(CONTACT_TITLE_MAX_LENGTH)
        );
    });

    it('content_too_long message includes the max length', () => {
        expect(CONTACT_ERROR_MESSAGES.content_too_long).toContain(
            String(CONTACT_CONTENT_MAX_LENGTH)
        );
    });

    it('email_invalid message mentions email format', () => {
        expect(CONTACT_ERROR_MESSAGES.email_invalid).toContain('이메일');
    });

    it('submission_failed message suggests retrying', () => {
        expect(CONTACT_ERROR_MESSAGES.submission_failed).toContain('다시');
    });
});
