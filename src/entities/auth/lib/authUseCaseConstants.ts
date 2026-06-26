/** @internal Error code returned when registration finds an existing email. */
export const EMAIL_ALREADY_EXISTS_CODE = 'email_already_exists' as const;

/** @internal Error code returned for unknown or already-consumed password reset tokens. */
export const PASSWORD_RESET_INVALID_TOKEN_CODE = 'invalid_token' as const;

/** @internal Error code returned when a password reset token has expired. */
export const PASSWORD_RESET_EXPIRED_TOKEN_CODE = 'expired_token' as const;

/** @internal Error code returned when an email verification code is missing or wrong. */
export const EMAIL_VERIFICATION_INVALID_CODE =
    'invalid_verification_code' as const;

/** @internal Error code returned when registerUser is called without prior email verification. */
export const EMAIL_NOT_VERIFIED_CODE = 'email_not_verified' as const;

/** @internal Password reset token lifetime in seconds (30 minutes). */
export const PASSWORD_RESET_TTL_SECONDS = 30 * 60;

/** @internal Email verification pending state lifetime in seconds (30 minutes). */
export const EMAIL_VERIFICATION_PENDING_TTL_SECONDS = 30 * 60;

/** @internal Email verification verified state lifetime in seconds (30 minutes). */
export const EMAIL_VERIFICATION_VERIFIED_TTL_SECONDS = 30 * 60;

/** @internal Number of bytes drawn for password reset URL-safe tokens. */
export const PASSWORD_RESET_TOKEN_BYTE_LENGTH = 32;

/** @internal Number of digits in numeric email verification codes. */
export const EMAIL_VERIFICATION_CODE_LENGTH = 6;
