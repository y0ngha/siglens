import type { EmailTokenStore } from '@/entities/email-token/types';
import type { AgreementRepository } from '@/entities/agreement/api';
import type { OAuthRevoker } from '@/entities/oauth-account/lib/revokerTypes';
import type {
    AuthSessionRecord,
    EmailAuthUserRepository,
    OAuthAccountRepository,
    SessionRepository,
    UserRepository,
} from '@/shared/db/types';
import type { EmailDispatcher, EmailMessage } from '@/shared/email/types';
import type {
    AuthSessionCookie,
    AuthUserRecord,
    ConfirmPasswordResetError,
    DeleteAccountErrorCode,
    LoginUserErrorCode,
    PasswordHasher,
    PasswordVerifier,
    RegisterUserError,
    VerifyEmailErrorCode,
} from '@/shared/lib/auth/types';
import type { OAuthProvider } from '@/shared/lib/types';

/** OAuth 로그인·가입 입력. `accessToken`·`refreshToken`은 저장 시 암호화된다. */
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

/** 이메일 가입 입력. `agreedTermsIds`는 비어 있으면 안 된다(필수 동의 확인). */
export interface RegisterUserInput {
    email: string;
    password: string;
    name?: string;
    avatarUrl?: string;
    agreedTermsIds: readonly string[];
}

/** 이메일 가입 결과. 성공 시 비밀번호 해시 없는 사용자 레코드. */
export type RegisterUserResult =
    | { ok: true; user: AuthUserRecord }
    | { ok: false; error: RegisterUserError };

/** `registerUser`가 주입받는 저장소·해셔·인증 토큰 저장소. */
export interface RegisterUserDependencies {
    users: UserRepository;
    agreements: AgreementRepository;
    passwordHasher: PasswordHasher;
    emailTokens: EmailTokenStore;
}

/** 이메일 로그인 입력. */
export interface LoginUserInput {
    email: string;
    password: string;
}

/** 로그인 실패 오류. 화면에는 `code`로 번역해 쓴다. */
export interface LoginUserError {
    code: LoginUserErrorCode;
    message: string;
}

/** 세션·쿠키 생성 옵션. 생략하면 `sessionCookie.ts`의 기본값(30일, `Path=/`, `SameSite=Lax`)이 적용된다. */
interface AuthSessionOptions {
    now?: Date;
    sessionTtlSeconds?: number;
    cookieName?: string;
    secureCookie?: boolean;
    sameSite?: AuthSessionCookie['sameSite'];
    path?: string;
}

/** `loginUser`가 주입받는 사용자·세션 저장소와 비밀번호 검증기. */
export interface LoginUserDependencies {
    users: EmailAuthUserRepository;
    sessions: SessionRepository;
    passwordVerifier: PasswordVerifier;
}

/** `loginUser` 옵션. 테스트에서 `now`를 고정할 수 있다. */
export type LoginUserOptions = AuthSessionOptions;

/** 로그인 결과. 성공 시 새 세션 행과 그 id를 담은 쿠키를 함께 돌려준다. */
export type LoginUserResult =
    | {
          ok: true;
          user: AuthUserRecord;
          session: AuthSessionRecord;
          cookie: AuthSessionCookie;
      }
    | { ok: false; error: LoginUserError };

/** 로그아웃 입력. */
export interface LogoutUserInput {
    sessionToken: string;
}

/** `logoutUser`가 주입받는 세션 저장소. */
export interface LogoutUserDependencies {
    sessions: SessionRepository;
}

/** 만료 쿠키의 이름·속성 재정의. 생략하면 세션 쿠키 기본값. */
export interface LogoutUserOptions {
    cookieName?: string;
    secureCookie?: boolean;
    sameSite?: AuthSessionCookie['sameSite'];
    path?: string;
}

/** 로그아웃 결과. `sessionInvalidated`는 세션 행을 실제로 지웠는지(이미 없었으면 false). */
export interface LogoutUserResult {
    ok: true;
    sessionInvalidated: boolean;
    cookie: AuthSessionCookie;
}

/** `findUserBySessionToken`이 주입받는 사용자·세션 저장소. */
export interface FindUserBySessionTokenDependencies {
    users: UserRepository;
    sessions: SessionRepository;
}

/** 만료 판정 기준 시각. 테스트에서 고정할 수 있다. */
export interface FindUserBySessionTokenOptions {
    now?: Date;
}

/** 계정 삭제 입력. */
export interface DeleteAccountInput {
    userId: string;
}

/**
 * 계정 삭제가 공개 API 키 인증을 즉시 끊기 위한 포트. 키 행은 FK cascade로 지워지지만
 * 인증 캐시는 TTL 동안 살아 있으므로, 삭제 전에 활성 키 해시를 읽고 삭제 뒤 무효화한다.
 */
export interface DeleteAccountApiKeys {
    listActiveKeyHashes(userId: string): Promise<string[]>;
    revokeAuth(keyHashes: readonly string[]): Promise<unknown>;
}

/** `deleteAccount`가 주입받는 저장소와 OAuth 폐기기, API 키 포트. */
export interface DeleteAccountDependencies {
    users: UserRepository;
    oauthAccounts: OAuthAccountRepository;
    oauthRevoker: OAuthRevoker;
    apiKeys: DeleteAccountApiKeys;
}

/** 만료 쿠키의 이름·속성 재정의. 생략하면 세션 쿠키 기본값. */
export interface DeleteAccountOptions {
    cookieName?: string;
    secureCookie?: boolean;
    sameSite?: AuthSessionCookie['sameSite'];
    path?: string;
}

/** 계정 삭제 실패 오류. 화면에는 `code`로 번역해 쓴다. */
export interface DeleteAccountError {
    code: DeleteAccountErrorCode;
    message: string;
}

/** 계정 삭제 결과. 성공 시 세션을 지우는 만료 쿠키를 돌려준다. */
export type DeleteAccountResult =
    | { ok: true; cookie: AuthSessionCookie }
    | { ok: false; error: DeleteAccountError };

/** 비밀번호 재설정 요청 입력. */
export interface RequestPasswordResetInput {
    email: string;
}

/** `requestPasswordReset`이 주입받는 사용자 저장소·토큰 저장소·메일 발송기. */
export interface RequestPasswordResetDependencies {
    users: EmailAuthUserRepository;
    emailTokens: EmailTokenStore;
    emailDispatcher: EmailDispatcher;
}

/** 토큰으로 메일 본문을 만드는 빌더. 링크 구성은 호출자(feature)가 정한다. */
export interface RequestPasswordResetOptions {
    buildMessage: (token: string) => EmailMessage;
}

/** 재설정 요청 결과. 존재하지 않는 계정도 `ok: true`(`tokenIssued: false`)라 계정 존재 여부가 새지 않는다. */
export type RequestPasswordResetResult =
    | { ok: true; tokenIssued: true; emailDispatched: boolean }
    | { ok: true; tokenIssued: false; emailDispatched: false };

/** 비밀번호 재설정 확정 입력. `token`은 메일로 받은 원문 토큰. */
export interface ConfirmPasswordResetInput {
    email: string;
    token: string;
    newPassword: string;
}

/** 재설정 확정 결과. */
export type ConfirmPasswordResetResult =
    | { ok: true }
    | { ok: false; error: ConfirmPasswordResetError };

/** `confirmPasswordReset`이 주입받는 저장소·토큰 저장소·해셔·검증기. */
export interface ConfirmPasswordResetDependencies {
    emailAuthUsers: EmailAuthUserRepository;
    users: UserRepository;
    emailTokens: EmailTokenStore;
    passwordHasher: PasswordHasher;
    passwordVerifier: PasswordVerifier;
}

/** 이메일 인증 코드 요청 입력. */
export interface RequestEmailVerificationInput {
    email: string;
}

/** `requestEmailVerification`이 주입받는 토큰 저장소와 메일 발송기. */
export interface RequestEmailVerificationDependencies {
    emailTokens: EmailTokenStore;
    emailDispatcher: EmailDispatcher;
}

/** 코드로 메일 본문을 만드는 빌더. */
export interface RequestEmailVerificationOptions {
    buildMessage: (code: string) => EmailMessage;
}

/** 코드 요청 결과. 잘못된 이메일은 `ok: true`(`codeIssued: false`). */
export type RequestEmailVerificationResult =
    | { ok: true; codeIssued: true; emailDispatched: boolean }
    | { ok: true; codeIssued: false; emailDispatched: false };

/** 이메일 인증 코드 확인 입력. `code`는 사용자가 입력한 원문. */
export interface VerifyEmailInput {
    email: string;
    code: string;
}

/** 인증 코드 확인 실패 오류. 화면에는 `code`로 번역해 쓴다. */
export interface VerifyEmailError {
    code: VerifyEmailErrorCode;
    field: 'code';
    message: string;
}

/** `verifyEmail`이 주입받는 토큰 저장소. */
export interface VerifyEmailDependencies {
    emailTokens: EmailTokenStore;
}

/** 인증 코드 확인 결과. */
export type VerifyEmailResult =
    | { ok: true }
    | { ok: false; error: VerifyEmailError };
