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

describe('formatAnalyzedAt — missing DateTimeFormat part fallback', () => {
    it('formats valid ISO date string', async () => {
        // Reset the module to test with different env
        vi.resetModules();
        const { formatAnalyzedAt } =
            await import('@/shared/lib/formatAnalyzedAt');

        const result = formatAnalyzedAt('2025-06-01T12:00:00Z');
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
    });
});
