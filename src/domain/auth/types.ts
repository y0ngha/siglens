import type {
    AuthValidationErrorCode,
    AuthValidationErrorField,
} from './validation';

/** Error code returned when user registration fails. */
export type RegisterUserErrorCode =
    | AuthValidationErrorCode
    | 'email_already_exists'
    | 'email_not_verified';

/** Input field associated with a registration validation error. */
export type RegisterUserErrorField = AuthValidationErrorField;

/** Structured validation/conflict error returned when registration fails. */
export interface RegisterUserError {
    code: RegisterUserErrorCode;
    field: RegisterUserErrorField;
    message: string;
}

/** Error code returned when email login fails. */
export type LoginUserErrorCode = 'invalid_credentials';

/** Error code returned when account deletion cannot be completed. */
export type DeleteAccountErrorCode = 'user_not_found';

/** Error code returned when email verification fails. */
export type VerifyEmailErrorCode =
    | 'invalid_verification_code'
    | 'expired_verification_code';

/** Error code returned when password reset confirmation fails. */
export type ConfirmPasswordResetErrorCode =
    | AuthValidationErrorCode
    | 'invalid_token'
    | 'expired_token';

/** Structured error returned when password reset confirmation fails. */
export interface ConfirmPasswordResetError {
    code: ConfirmPasswordResetErrorCode;
    field?: AuthValidationErrorField | 'token';
    message: string;
}
