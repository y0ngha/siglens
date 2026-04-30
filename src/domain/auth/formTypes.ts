import type {
    DeleteAccountErrorCode,
    LoginUserErrorCode,
} from '@y0ngha/siglens-core';
// TODO(siglens-core#55): replace with real types once new core publishes.
import type {
    ConfirmPasswordResetV2Error,
    ConfirmPasswordResetV2ErrorCode,
    RegisterUserV2Error,
    RegisterUserV2ErrorCode,
    VerifyEmailErrorCode,
} from '@/domain/auth/coreStubs';

export interface LoginFormState {
    error: { code: LoginUserErrorCode; message: string } | null;
}

export interface SignupFormState {
    error: {
        code: RegisterUserV2ErrorCode | 'auto_login_failed';
        field?: RegisterUserV2Error['field'];
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

export interface ResetPasswordFormState {
    error: {
        code: ConfirmPasswordResetV2ErrorCode;
        field?: ConfirmPasswordResetV2Error['field'];
        message: string;
    } | null;
}

export interface RequestEmailVerificationFormState {
    submitted: boolean;
    error: { code: string; message: string } | null;
}

export interface VerifyEmailFormState {
    verified: boolean;
    error: { code: VerifyEmailErrorCode; message: string } | null;
}
