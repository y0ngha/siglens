import {
    getFieldError,
    getSubmissionError,
    resolveEmailDefault,
} from '@/features/contact-form/lib/contactFormUtils';
import { CONTACT_ERROR_KEY } from '@/shared/lib/contactErrorMessages';
import {
    CONTACT_CONTENT_MAX_LENGTH,
    CONTACT_TITLE_MAX_LENGTH,
} from '@/shared/config/contact';

/** 실제 번역 카탈로그 대신 키와 값을 그대로 드러내는 스텁 — 어떤 키·값이 넘어갔는지 검증한다. */
const fakeT = (key: string, values?: Record<string, number>): string =>
    values ? `${key}:${JSON.stringify(values)}` : key;

describe('getFieldError', () => {
    it('returns undefined when there is no error', () => {
        expect(getFieldError(null, 'title', fakeT)).toBeUndefined();
    });

    it('returns undefined when the error belongs to a different field', () => {
        const error = {
            code: 'content_required' as const,
            field: 'content' as const,
        };
        expect(getFieldError(error, 'title', fakeT)).toBeUndefined();
    });

    it('returns the translated message for a matching field error', () => {
        const error = {
            code: 'title_required' as const,
            field: 'title' as const,
        };
        expect(getFieldError(error, 'title', fakeT)).toBe(
            CONTACT_ERROR_KEY.title_required
        );
    });

    it('includes the max-length value for title_too_long', () => {
        const error = {
            code: 'title_too_long' as const,
            field: 'title' as const,
        };
        expect(getFieldError(error, 'title', fakeT)).toBe(
            `${CONTACT_ERROR_KEY.title_too_long}:${JSON.stringify({ v0: CONTACT_TITLE_MAX_LENGTH })}`
        );
    });

    it('includes the max-length value for content_too_long', () => {
        const error = {
            code: 'content_too_long' as const,
            field: 'content' as const,
        };
        expect(getFieldError(error, 'content', fakeT)).toBe(
            `${CONTACT_ERROR_KEY.content_too_long}:${JSON.stringify({ v0: CONTACT_CONTENT_MAX_LENGTH })}`
        );
    });
});

describe('getSubmissionError', () => {
    it('returns undefined when there is no error', () => {
        expect(getSubmissionError(null, fakeT)).toBeUndefined();
    });

    it('returns undefined when the error is scoped to a specific field', () => {
        const error = {
            code: 'email_invalid' as const,
            field: 'email' as const,
        };
        expect(getSubmissionError(error, fakeT)).toBeUndefined();
    });

    it('returns the translated message for a form-level (fieldless) error', () => {
        const error = { code: 'submission_failed' as const };
        expect(getSubmissionError(error, fakeT)).toBe(
            CONTACT_ERROR_KEY.submission_failed
        );
    });
});

describe('resolveEmailDefault', () => {
    const values = { title: 't', email: 'typed@example.com', content: 'c' };

    it('prefills the signed-in email before any action result', () => {
        const state = { submitted: false, error: null, values };
        expect(resolveEmailDefault(state, 'me@example.com')).toBe(
            'me@example.com'
        );
    });

    it('returns an empty string for a signed-out visitor', () => {
        const state = { submitted: false, error: null, values };
        expect(resolveEmailDefault(state, undefined)).toBe('');
    });

    it('keeps what the user sent once the action returned an error', () => {
        const state = {
            submitted: false,
            error: { code: 'title_required' as const, field: 'title' as const },
            values,
        };
        expect(resolveEmailDefault(state, 'me@example.com')).toBe(
            'typed@example.com'
        );
    });
});
