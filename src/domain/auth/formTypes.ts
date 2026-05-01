import type {
    ConfirmPasswordResetError,
    ConfirmPasswordResetErrorCode,
    DeleteAccountErrorCode,
    LoginUserErrorCode,
    RegisterUserError,
    RegisterUserErrorCode,
    VerifyEmailErrorCode,
} from '@y0ngha/siglens-core';

export interface LoginFormState {
    error: { code: LoginUserErrorCode; message: string } | null;
}

export interface SignupFormState {
    error: {
        code: RegisterUserErrorCode | 'auto_login_failed';
        field?: RegisterUserError['field'];
        message: string;
    } | null;
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

type ResetPasswordLocalErrorCode = 'redis_unavailable';

export interface ResetPasswordFormState {
    error: {
        code: ConfirmPasswordResetErrorCode | ResetPasswordLocalErrorCode;
        field?: ConfirmPasswordResetError['field'];
        message: string;
    } | null;
}

export type RequestEmailVerificationErrorCode = 'redis_unavailable';

export interface RequestEmailVerificationFormState {
    submitted: boolean;
    error: { code: RequestEmailVerificationErrorCode; message: string } | null;
}

type VerifyEmailLocalErrorCode = 'redis_unavailable';

export interface VerifyEmailFormState {
    verified: boolean;
    error: {
        code: VerifyEmailErrorCode | VerifyEmailLocalErrorCode;
        message: string;
    } | null;
}
