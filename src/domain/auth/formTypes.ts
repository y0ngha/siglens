import type {
    ConfirmPasswordResetError,
    ConfirmPasswordResetErrorCode,
    DeleteAccountErrorCode,
    LoginUserErrorCode,
    RegisterUserError,
    RegisterUserErrorCode,
    VerifyEmailErrorCode,
} from '@/domain/auth/types';

export interface LoginFormState {
    error: { code: LoginUserErrorCode; message: string } | null;
}

export type DeleteAccountFormErrorCode =
    | DeleteAccountErrorCode
    | 'not_authenticated'
    | 'email_mismatch';

export interface DeleteAccountFormState {
    error: { code: DeleteAccountFormErrorCode; message: string } | null;
}

export interface ForgotPasswordFormState {
    /** Always returns success message regardless of account existence (enumeration mitigation). */
    submitted: boolean;
}

export type LocalInfraErrorCode = 'redis_unavailable';

export type RequestEmailVerificationErrorCode =
    | LocalInfraErrorCode
    | 'invalid_email';

export type SignupFormErrorCode =
    | RegisterUserErrorCode
    | 'auto_login_failed'
    | 'consent_required'
    | 'service_unavailable'
    | LocalInfraErrorCode;

export interface SignupFormState {
    error: {
        code: SignupFormErrorCode;
        field?: RegisterUserError['field'];
        message: string;
    } | null;
}

export interface ResetPasswordFormState {
    error: {
        code: ConfirmPasswordResetErrorCode | LocalInfraErrorCode;
        field?: ConfirmPasswordResetError['field'];
        message: string;
    } | null;
}

export interface RequestEmailVerificationFormState {
    submitted: boolean;
    error: { code: RequestEmailVerificationErrorCode; message: string } | null;
}

export interface VerifyEmailFormState {
    verified: boolean;
    error: {
        code: VerifyEmailErrorCode | LocalInfraErrorCode;
        message: string;
    } | null;
}

export type FinalizeOAuthSignupError = { code: 'consent_required'; message: string };

export interface FinalizeOAuthSignupState {
    error?: FinalizeOAuthSignupError;
}
