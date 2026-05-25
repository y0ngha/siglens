/**
 * Quick branch coverage tests for miscellaneous 1-branch gaps.
 */

import { getFieldError } from '@/features/contact-form/lib/contactFormUtils';
import type { ContactFormError } from '@/shared/lib/types';
import { CONTACT_ERROR_MESSAGES } from '@/shared/lib/contactErrorMessages';

describe('contactFormUtils — getFieldError matching field branch', () => {
    it('returns error message when field matches', () => {
        const error: ContactFormError = {
            field: 'email',
            code: 'email_required',
        };

        const result = getFieldError(error, 'email');
        expect(result).toBe(CONTACT_ERROR_MESSAGES.email_required);
    });
});
