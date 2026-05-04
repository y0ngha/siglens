import type { UserTier } from '@y0ngha/siglens-core';
import type {
    AuthValidationErrorCode,
    AuthValidationErrorField,
} from '@/domain/auth/validation';

/** A persisted user account record returned from the database. */
export interface AuthUserRecord {
    /** Unique user identifier (UUID). */
    id: string;
    /** Normalized (lowercased, trimmed) email address. */
    email: string;
    /** Optional display name; null when not provided at registration. */
    name: string | null;
    /** Optional avatar image URL; null when not provided at registration. */
    avatarUrl: string | null;
    /** Subscription tier assigned to the user. */
    tier: UserTier;
    /** Whether the email address has been verified by the user. */
    emailVerified: boolean;
    /** Timestamp when the account was created. */
    createdAt: Date;
    /** Timestamp when the account was last updated. */
    updatedAt: Date;
}

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
    | 'expired_verification_code'
    | 'email_already_exists';

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
