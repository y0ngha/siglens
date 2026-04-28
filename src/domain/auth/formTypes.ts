import type {
    RegisterUserErrorCode,
    RegisterUserErrorField,
} from '@y0ngha/siglens-core';

export interface LoginFormState {
    error: { code: string; message: string } | null;
}

export interface SignupFormState {
    error: {
        code: RegisterUserErrorCode | 'auto_login_failed';
        field?: RegisterUserErrorField;
        message: string;
    } | null;
}
