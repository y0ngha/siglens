/**
 * TEMPORARY: stubs for siglens-core APIs in active development (issue siglens-core#55).
 *
 * These types and runtime helpers mirror the proposed contract from
 * y0ngha/siglens#394 but are not yet exported by the published @y0ngha/siglens-core
 * package (latest 0.1.14). Once the new core version ships, replace every import
 * from this file with the real export and delete this module.
 *
 * Do NOT add business logic here. Stubs are types + thin factory wrappers only.
 */
// EmailMessage shape mirrors what siglens-core will export. infrastructure
// modules re-export this type for convenience.
export interface EmailMessage {
    to: string;
    subject: string;
    html: string;
    text: string;
}

const NOT_PUBLISHED =
    '[siglens-core stub] feature waiting on siglens-core#55 publication. Set up RESEND_API_KEY + UPSTASH_REDIS_REST_URL/TOKEN before depending on this surface in production.';

// ─── EmailTokenStore ────────────────────────────────────────────────────────

export type EmailTokenPurpose = 'password_reset' | 'email_verification';

export type EmailTokenValue =
    | { status: 'pending'; tokenHash: string }
    | { status: 'verified' };

export interface EmailTokenStore {
    set(
        purpose: EmailTokenPurpose,
        email: string,
        value: EmailTokenValue,
        ttlSeconds: number
    ): Promise<void>;
    get(
        purpose: EmailTokenPurpose,
        email: string
    ): Promise<EmailTokenValue | null>;
    delete(purpose: EmailTokenPurpose, email: string): Promise<void>;
}

/**
 * Placeholder for the future `createEmailTokenStore()` core factory. The real
 * implementation will read `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
 * env vars and back the store with Upstash Redis.
 */
export function createEmailTokenStore(): EmailTokenStore {
    return {
        set: async () => {
            throw new Error(NOT_PUBLISHED);
        },
        get: async () => {
            throw new Error(NOT_PUBLISHED);
        },
        delete: async () => {
            throw new Error(NOT_PUBLISHED);
        },
    };
}

// ─── requestEmailVerification / verifyEmail ─────────────────────────────────

export interface RequestEmailVerificationInput {
    email: string;
}

export type RequestEmailVerificationErrorCode =
    | 'invalid_email'
    | 'rate_limited';

export interface RequestEmailVerificationError {
    code: RequestEmailVerificationErrorCode;
    message: string;
}

export type RequestEmailVerificationResult =
    | { ok: true }
    | { ok: false; error: RequestEmailVerificationError };

export interface VerifyEmailInput {
    email: string;
    code: string;
}

export type VerifyEmailErrorCode =
    | 'invalid_code'
    | 'expired_code'
    | 'no_pending_verification';

export interface VerifyEmailError {
    code: VerifyEmailErrorCode;
    message: string;
}

export type VerifyEmailResult =
    | { ok: true }
    | { ok: false; error: VerifyEmailError };

export async function requestEmailVerification(
    _input: RequestEmailVerificationInput,
    _deps: unknown,
    _options: { buildMessage: (code: string) => EmailMessage }
): Promise<RequestEmailVerificationResult> {
    throw new Error(NOT_PUBLISHED);
}

export async function verifyEmail(
    _input: VerifyEmailInput,
    _deps: unknown
): Promise<VerifyEmailResult> {
    throw new Error(NOT_PUBLISHED);
}

// ─── PasswordReset (variant) ────────────────────────────────────────────────
// 새 시그니처 — input.email 필수, deps에 emailTokens 포함, options.buildMessage 콜백.
// 본 모듈이 노출되는 동안 consumer 측 Server Action은 이 타입에 맞춰 작성한다.

export interface RequestPasswordResetV2Input {
    email: string;
}

export type RequestPasswordResetV2Result =
    | { ok: true }
    | { ok: false; error: { code: string; message: string } };

export interface ConfirmPasswordResetV2Input {
    email: string;
    token: string;
    newPassword: string;
}

export type ConfirmPasswordResetV2ErrorCode =
    | 'invalid_token'
    | 'expired_token'
    | 'weak_password'
    | 'invalid_password'
    | 'invalid_email';

export interface ConfirmPasswordResetV2Error {
    code: ConfirmPasswordResetV2ErrorCode;
    field?: 'email' | 'token' | 'password';
    message: string;
}

export type ConfirmPasswordResetV2Result =
    | { ok: true }
    | { ok: false; error: ConfirmPasswordResetV2Error };

export async function requestPasswordResetV2(
    _input: RequestPasswordResetV2Input,
    _deps: unknown,
    _options: { buildMessage: (token: string) => EmailMessage }
): Promise<RequestPasswordResetV2Result> {
    throw new Error(NOT_PUBLISHED);
}

export async function confirmPasswordResetV2(
    _input: ConfirmPasswordResetV2Input,
    _deps: unknown
): Promise<ConfirmPasswordResetV2Result> {
    throw new Error(NOT_PUBLISHED);
}

// ─── registerUser (variant) ─────────────────────────────────────────────────
// 새 시그니처 — deps 객체에 emailTokens 포함, 가입 전 email_verification 상태 확인.
import type { AuthUserRecord } from '@y0ngha/siglens-core';

export interface RegisterUserV2Input {
    email: string;
    password: string;
    name?: string;
    avatarUrl?: string;
}

export type RegisterUserV2ErrorCode =
    | 'invalid_email'
    | 'weak_password'
    | 'email_already_exists'
    | 'email_not_verified';

export interface RegisterUserV2Error {
    code: RegisterUserV2ErrorCode;
    field?: 'email' | 'password';
    message: string;
}

export type RegisterUserV2Result =
    | { ok: true; user: AuthUserRecord }
    | { ok: false; error: RegisterUserV2Error };

export async function registerUserV2(
    _input: RegisterUserV2Input,
    _deps: unknown
): Promise<RegisterUserV2Result> {
    throw new Error(NOT_PUBLISHED);
}
