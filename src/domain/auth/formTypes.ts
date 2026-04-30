import type {
    DeleteAccountErrorCode,
    LoginUserErrorCode,
    RegisterUserErrorCode,
    RegisterUserErrorField,
} from '@y0ngha/siglens-core';

export interface LoginFormState {
    error: { code: LoginUserErrorCode; message: string } | null;
}

export interface SignupFormState {
    error: {
        code: RegisterUserErrorCode | 'auto_login_failed';
        field?: RegisterUserErrorField;
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
