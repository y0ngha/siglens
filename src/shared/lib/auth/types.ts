import type { UserTier } from '@y0ngha/siglens-core';
import type {
    AuthValidationErrorCode,
    AuthValidationErrorField,
} from '@/shared/lib/auth/validation';

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
    | 'email_not_verified'
    | 'invalid_input';

/** Input field associated with a registration validation error. */
export type RegisterUserErrorField = AuthValidationErrorField;

/** Structured validation/conflict error returned when registration fails. */
export interface RegisterUserError {
    code: RegisterUserErrorCode;
    field?: RegisterUserErrorField;
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
    | 'expired_token'
    | 'same_password';

/** Structured error returned when password reset confirmation fails. */
export interface ConfirmPasswordResetError {
    code: ConfirmPasswordResetErrorCode;
    field?: AuthValidationErrorField | 'token';
    message: string;
}

/** Shape of the HTTP-only session cookie set after authentication. */
export interface AuthSessionCookie {
    name: string;
    value: string;
    httpOnly: true;
    secure: boolean;
    sameSite: 'lax' | 'strict' | 'none';
    path: string;
    expires: Date;
    maxAgeSeconds: number;
}

/** Interface for hashing plain-text passwords before storage. */
export interface PasswordHasher {
    /** Hash a plain-text password and return the storage-safe hash. */
    hashPassword(password: string): Promise<string>;
}

/** Interface for comparing a plain-text password against a stored password hash. */
export interface PasswordVerifier {
    /** Compare a plain-text password with a stored password hash in constant time. */
    verifyPassword(password: string, passwordHash: string): Promise<boolean>;
}
