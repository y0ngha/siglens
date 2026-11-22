import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { IntlTestProvider } from '@/shared/test-utils/intlRenderWrapper';
import { useDescribeAuthError } from '@/shared/hooks/useDescribeAuthError';
import koMessages from '../../../../messages/ko.json';

function renderDescribe() {
    return renderHook(() => useDescribeAuthError(), {
        wrapper: IntlTestProvider,
    }).result.current;
}

describe('useDescribeAuthError', () => {
    it('returns undefined when there is no error', () => {
        const describeAuthError = renderDescribe();
        expect(describeAuthError(null)).toBeUndefined();
        expect(describeAuthError(undefined)).toBeUndefined();
    });

    it('translates a code listed in AUTH_ERROR_KEY', () => {
        const describeAuthError = renderDescribe();
        expect(
            describeAuthError({ code: 'invalid_credentials', message: '원문' })
        ).toBe(koMessages.entities.auth.error.invalidCredentials);
    });

    it('translates the email verification code errors verifyEmail emits', () => {
        const describeAuthError = renderDescribe();
        expect(
            describeAuthError({
                code: 'invalid_verification_code',
                message: '원문',
            })
        ).toBe(koMessages.entities.auth.error.invalidCode);
        expect(
            describeAuthError({
                code: 'expired_verification_code',
                message: '원문',
            })
        ).toBe(koMessages.entities.auth.error.expiredCode);
    });

    it('translates email_send_failed to the verification mail failure copy', () => {
        const describeAuthError = renderDescribe();
        expect(
            describeAuthError({ code: 'email_send_failed', message: '원문' })
        ).toBe(koMessages.entities.auth.error.verificationEmailFailed);
    });

    it('translates the signup verification limit errors to their own messages', () => {
        const describeAuthError = renderDescribe();
        expect(
            describeAuthError({ code: 'rate_limited', message: '원문' })
        ).toBe(koMessages.entities.auth.error.tooManyRequests);
        expect(
            describeAuthError({
                code: 'too_many_verification_attempts',
                message: '원문',
            })
        ).toBe(koMessages.entities.auth.error.tooManyCodeAttempts);
    });

    it('falls back to the raw message for an unknown or missing code', () => {
        const describeAuthError = renderDescribe();
        expect(describeAuthError({ code: 'unexpected', message: '원문' })).toBe(
            '원문'
        );
        expect(describeAuthError({ message: '원문' })).toBe('원문');
    });
});
