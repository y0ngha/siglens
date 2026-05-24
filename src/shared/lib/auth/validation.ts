import {
    INVALID_EMAIL_CODE,
    WEAK_PASSWORD_CODE,
} from '@/shared/lib/auth/constants';

/** Validation error code shared across auth use-cases. */
export type AuthValidationErrorCode = 'invalid_email' | 'weak_password';

/** Input field associated with an auth validation error. */
export type AuthValidationErrorField = 'email' | 'password';

/** Structured validation error produced by domain auth helpers. */
export interface AuthValidationError {
    /** Machine-readable error code identifying the failure reason. */
    code: AuthValidationErrorCode;
    /** Input field that caused the error. */
    field: AuthValidationErrorField;
    /** Human-readable error message suitable for display to the user. */
    message: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const INVALID_EMAIL_MESSAGE = '올바른 이메일 형식이 아닙니다.';
const WEAK_PASSWORD_MESSAGE = `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이며 영문자와 숫자를 포함해야 합니다.`;

/** @internal Normalizes an email address for consistent storage and lookup. */
export function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

function hasLetter(value: string): boolean {
    return /[A-Za-z]/.test(value);
}

function hasNumber(value: string): boolean {
    return /\d/.test(value);
}

/** @internal Returns a validation error if the email format is invalid, null otherwise. */
export function validateEmail(email: string): AuthValidationError | null {
    return EMAIL_PATTERN.test(email)
        ? null
        : {
              code: INVALID_EMAIL_CODE,
              field: 'email',
              message: INVALID_EMAIL_MESSAGE,
          };
}

/** @internal Returns a validation error if the password does not meet strength requirements, null otherwise. */
export function validatePassword(password: string): AuthValidationError | null {
    return password.length >= MIN_PASSWORD_LENGTH &&
        hasLetter(password) &&
        hasNumber(password)
        ? null
        : {
              code: WEAK_PASSWORD_CODE,
              field: 'password',
              message: WEAK_PASSWORD_MESSAGE,
          };
}
