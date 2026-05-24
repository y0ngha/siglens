import type { OAuthProvider } from '@/domain/types';
import type { AgreementRepository } from '@/entities/agreement';
import type {
    AuthSessionRecord,
    AuthUserRecord,
    EmailAuthUserRepository,
    OAuthAccountRepository,
    SessionRepository,
    UserRepository,
} from '@/shared/db/types';
import type { OAuthRevoker } from '@/infrastructure/auth/oauth/revokerTypes';
import type {
    PasswordHasher,
    PasswordVerifier,
} from '@/infrastructure/auth/types';
import type { EmailDispatcher, EmailMessage } from '@/shared/email';
import type { EmailTokenStore } from '@/entities/email-token';
import type {
    ConfirmPasswordResetError,
    ConfirmPasswordResetErrorCode,
    DeleteAccountErrorCode,
    LoginUserErrorCode,
    RegisterUserError,
    RegisterUserErrorCode,
    RegisterUserErrorField,
    VerifyEmailErrorCode,
} from '@/domain/auth/types';

export type {
    ConfirmPasswordResetError,
    ConfirmPasswordResetErrorCode,
    DeleteAccountErrorCode,
    LoginUserErrorCode,
    RegisterUserError,
    RegisterUserErrorCode,
    RegisterUserErrorField,
    VerifyEmailErrorCode,
};

export interface SocialLoginUserInput {
    provider: OAuthProvider;
    providerAccountId: string;
    email: string;
    name?: string;
    avatarUrl?: string;
    accessToken?: string;
    refreshToken?: string;
    tokenExpiresAt?: Date;
}

export interface RegisterUserInput {
    email: string;
    password: string;
    name?: string;
    avatarUrl?: string;
    agreedTermsIds: readonly string[];
}

export type RegisterUserResult =
    | { ok: true; user: AuthUserRecord }
    | { ok: false; error: RegisterUserError };

export interface RegisterUserDependencies {
    users: UserRepository;
    agreements: AgreementRepository;
    passwordHasher: PasswordHasher;
    emailTokens: EmailTokenStore;
}

export interface LoginUserInput {
    email: string;
    password: string;
}

export interface LoginUserError {
    code: LoginUserErrorCode;
    message: string;
}

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

export interface AuthSessionOptions {
    now?: Date;
    sessionTtlSeconds?: number;
    cookieName?: string;
    secureCookie?: boolean;
    sameSite?: AuthSessionCookie['sameSite'];
    path?: string;
}

export interface LoginUserDependencies {
    users: EmailAuthUserRepository;
    sessions: SessionRepository;
    passwordVerifier: PasswordVerifier;
}

export type LoginUserOptions = AuthSessionOptions;

export type LoginUserResult =
    | {
          ok: true;
          user: AuthUserRecord;
          session: AuthSessionRecord;
          cookie: AuthSessionCookie;
      }
    | { ok: false; error: LoginUserError };

export interface LogoutUserInput {
    sessionToken: string;
}

export interface LogoutUserDependencies {
    sessions: SessionRepository;
}

export interface LogoutUserOptions {
    cookieName?: string;
    secureCookie?: boolean;
    sameSite?: AuthSessionCookie['sameSite'];
    path?: string;
}

export interface LogoutUserResult {
    ok: true;
    sessionInvalidated: boolean;
    cookie: AuthSessionCookie;
}

export interface FindUserBySessionTokenDependencies {
    users: UserRepository;
    sessions: SessionRepository;
}

export interface FindUserBySessionTokenOptions {
    now?: Date;
}

export interface DeleteAccountInput {
    userId: string;
}

export interface DeleteAccountDependencies {
    users: UserRepository;
    oauthAccounts: OAuthAccountRepository;
    oauthRevoker: OAuthRevoker;
}

export interface DeleteAccountOptions {
    cookieName?: string;
    secureCookie?: boolean;
    sameSite?: AuthSessionCookie['sameSite'];
    path?: string;
}

export interface DeleteAccountError {
    code: DeleteAccountErrorCode;
    message: string;
}

export type DeleteAccountResult =
    | { ok: true; cookie: AuthSessionCookie }
    | { ok: false; error: DeleteAccountError };

export interface RequestPasswordResetInput {
    email: string;
}

export interface RequestPasswordResetDependencies {
    users: EmailAuthUserRepository;
    emailTokens: EmailTokenStore;
    emailDispatcher: EmailDispatcher;
}

export interface RequestPasswordResetOptions {
    buildMessage: (token: string) => EmailMessage;
}

export type RequestPasswordResetResult =
    | { ok: true; tokenIssued: true; emailDispatched: boolean }
    | { ok: true; tokenIssued: false; emailDispatched: false };

export interface ConfirmPasswordResetInput {
    email: string;
    token: string;
    newPassword: string;
}

export type ConfirmPasswordResetResult =
    | { ok: true }
    | { ok: false; error: ConfirmPasswordResetError };

export interface ConfirmPasswordResetDependencies {
    emailAuthUsers: EmailAuthUserRepository;
    users: UserRepository;
    emailTokens: EmailTokenStore;
    passwordHasher: PasswordHasher;
    passwordVerifier: PasswordVerifier;
}

export interface RequestEmailVerificationInput {
    email: string;
}

export interface RequestEmailVerificationDependencies {
    emailTokens: EmailTokenStore;
    emailDispatcher: EmailDispatcher;
}

export interface RequestEmailVerificationOptions {
    buildMessage: (code: string) => EmailMessage;
}

export type RequestEmailVerificationResult =
    | { ok: true; codeIssued: true; emailDispatched: boolean }
    | { ok: true; codeIssued: false; emailDispatched: false };

export interface VerifyEmailInput {
    email: string;
    code: string;
}

export interface VerifyEmailError {
    code: VerifyEmailErrorCode;
    field: 'code';
    message: string;
}

export interface VerifyEmailDependencies {
    emailTokens: EmailTokenStore;
}

export type VerifyEmailResult =
    | { ok: true }
    | { ok: false; error: VerifyEmailError };
