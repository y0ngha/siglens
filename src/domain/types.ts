/** siglens 앱에서 현재 활성화된 OAuth provider. */
export type SupportedOAuthProvider = 'google' | 'kakao';

export type {
    DeleteAccountFormErrorCode,
    DeleteAccountFormState,
    ForgotPasswordFormState,
    LoginFormState,
    RequestEmailVerificationErrorCode,
    RequestEmailVerificationFormState,
    ResetPasswordFormState,
    SignupFormState,
    VerifyEmailFormState,
} from './auth/formTypes';
