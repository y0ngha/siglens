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
/**
 * 이 모듈은 요청 스코프 없는 순수 검증 함수라 표시 문구를 만들 수 없다.
 * `message`는 **로그·폴백용 영어 원문**이고, 화면은 UI 경계가 `code`를
 * `AUTH_ERROR_KEY`로 번역해서 낸다(`shared/lib/authErrorKey.ts` 참고).
 * 한국어를 들면 `/en/signup`이 영어 폼에 한국어 검증 메시지를 띄운다.
 */
const INVALID_EMAIL_MESSAGE = 'Invalid email format.';
const WEAK_PASSWORD_MESSAGE = `Password must be at least ${MIN_PASSWORD_LENGTH} characters and include a letter and a number.`;

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
