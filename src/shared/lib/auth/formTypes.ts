import type {
    ConfirmPasswordResetError,
    ConfirmPasswordResetErrorCode,
    DeleteAccountErrorCode,
    LoginUserErrorCode,
    RegisterUserError,
    RegisterUserErrorCode,
    VerifyEmailErrorCode,
} from '@/shared/lib/auth/types';

export interface LoginFormState {
    error: {
        code: LoginUserErrorCode | UnexpectedErrorCode;
        message: string;
    } | null;
}

export type DeleteAccountFormErrorCode =
    | DeleteAccountErrorCode
    | 'not_authenticated'
    | 'email_mismatch'
    | UnexpectedErrorCode;

export interface DeleteAccountFormState {
    error: { code: DeleteAccountFormErrorCode; message: string } | null;
}

export interface ForgotPasswordFormState {
    /** Always returns success message regardless of account existence (enumeration mitigation). */
    submitted: boolean;
    /**
     * 입력 **형식** 오류. 계정 존재 여부와 무관한 것만 담는다.
     *
     * 열거 방어는 "이 주소가 가입돼 있는가"를 숨기는 것이지, 빈 문자열이나
     * 이메일이 아닌 값에도 "메일을 보냈다"고 말해야 한다는 뜻이 아니다.
     * 폼이 `noValidate`(폼 13곳의 전역 관례)라 브라우저 검증이 돌지 않으므로,
     * 빈 제출이 그대로 액션에 도달해 성공 화면이 떴다.
     *
     * 문장이 아니라 **코드**다 — 서버 액션에는 요청 스코프 번역자가 없어
     * 한국어 문장을 담으면 `/en/forgot-password`가 영어 폼 위에 한국어
     * 오류를 띄운다. 표시는 `AUTH_ERROR_KEY`로 UI 경계에서 한다.
     */
    errorCode?: string;
}

export type LocalInfraErrorCode = 'redis_unavailable';

/**
 * Catch-all error code for unexpected runtime exceptions in Server Actions.
 * Kept separate from domain error codes to avoid polluting domain type contracts.
 */
export type UnexpectedErrorCode = 'unexpected';

export type RequestEmailVerificationErrorCode =
    | LocalInfraErrorCode
    | 'invalid_email'
    | UnexpectedErrorCode;

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
        code:
            | ConfirmPasswordResetErrorCode
            | LocalInfraErrorCode
            | UnexpectedErrorCode;
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
        code: VerifyEmailErrorCode | LocalInfraErrorCode | UnexpectedErrorCode;
        message: string;
    } | null;
}

export type FinalizeOAuthSignupError = {
    code: 'consent_required';
    message: string;
};

export interface FinalizeOAuthSignupState {
    error?: FinalizeOAuthSignupError;
}
