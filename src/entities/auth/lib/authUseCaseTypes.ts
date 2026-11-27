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
    /**
     * `siglens_signup_verify` 쿠키 값(인증한 브라우저가 받은 무작위 값). 없으면 `null`.
     * 마커에 저장된 해시와 맞아야 가입이 진행된다.
     */
    verificationBinding: string | null;
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

/** `loginUser`가 주입받는 사용자·세션 저장소, 비밀번호 검증기와 남용 한도 포트. */
export interface LoginUserDependencies {
    users: EmailAuthUserRepository;
    sessions: SessionRepository;
    passwordVerifier: PasswordVerifier;
    rateLimit: AuthRateLimiter;
    /** 한도 카운터를 0으로 되돌린다(성공한 로그인이 주소+IP 쌍 키를 푼다). */
    resetCounter: (key: string) => Promise<void>;
    /** 요청 IP의 해시 — 원본 IP는 키에도 로그에도 남지 않는다. */
    ipHash: () => Promise<string>;
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

/**
 * 계정 삭제가 알림 메일 신청을 함께 파기하기 위한 포트. 구독자 행의 주소는 회원 행에서 읽으므로
 * 회원 행을 지우기 **전에** 불러야 한다(`MailAlertSubscriberRepository.deleteForAccount`).
 */
export interface DeleteAccountMailAlerts {
    deleteForAccount(userId: string): Promise<number>;
}

/** `deleteAccount`가 주입받는 저장소와 OAuth 폐기기, API 키·알림 메일 포트. */
export interface DeleteAccountDependencies {
    users: UserRepository;
    oauthAccounts: OAuthAccountRepository;
    oauthRevoker: OAuthRevoker;
    apiKeys: DeleteAccountApiKeys;
    mailAlerts: DeleteAccountMailAlerts;
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

/** `requestPasswordReset`이 주입받는 사용자 저장소·토큰 저장소·메일 발송기와 남용 한도 포트. */
export interface RequestPasswordResetDependencies {
    users: EmailAuthUserRepository;
    emailTokens: EmailTokenStore;
    emailDispatcher: EmailDispatcher;
    rateLimit: AuthRateLimiter;
    /** 요청 IP의 해시 — 원본 IP는 키에도 로그에도 남지 않는다. */
    ipHash: () => Promise<string>;
    /**
     * 응답을 보낸 뒤 `task`를 실행한다(운영은 `afterWithDrain`). 계정이 있을 때만 하는 I/O를
     * 응답 경로 밖으로 빼 응답 시간이 계정 존재 여부를 드러내지 않게 한다. `task`는 스스로 실패를 처리한다.
     */
    deferDispatch: (task: () => Promise<void>) => void;
}

/** 토큰으로 메일 본문을 만드는 빌더. 링크 구성은 호출자(feature)가 정한다. */
export interface RequestPasswordResetOptions {
    buildMessage: (token: string) => EmailMessage;
}

/**
 * 재설정 요청 결과. 계정 유무와 발송 성패와 관계없이 `ok: true` 하나라 계정 존재 여부가 새지 않는다.
 * 한도에 걸리면 `rate_limited`다 — 주소·IP로만 정해지고 DB를 읽지 않으므로 열거 신호가 아니다.
 */
export type RequestPasswordResetResult =
    | { ok: true }
    | { ok: false; reason: 'rate_limited' };

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

/** `confirmPasswordReset`이 주입받는 저장소·토큰 저장소·해셔·검증기와 남용 한도 포트. */
export interface ConfirmPasswordResetDependencies {
    emailAuthUsers: EmailAuthUserRepository;
    users: UserRepository;
    emailTokens: EmailTokenStore;
    passwordHasher: PasswordHasher;
    passwordVerifier: PasswordVerifier;
    rateLimit: AuthRateLimiter;
    /** 한도 카운터를 0으로 되돌린다(재설정 성공이 로그인 잠금을 푼다). */
    resetCounter: (key: string) => Promise<void>;
    /** 요청 IP의 해시. */
    ipHash: () => Promise<string>;
}

/** 이메일 인증 코드 요청 입력. */
export interface RequestEmailVerificationInput {
    email: string;
}

/**
 * 인증 흐름(가입 코드·비밀번호 재설정·로그인)이 공유하는 한 번의 한도 확인.
 * `true`면 허용이다(고정 창 방식, Redis 장애는 통과). 호출 한 번이 시도 한 번이다.
 *
 * 알림 메일의 `MailAlertRateLimiter`와 같은 모양이지만, auth가 mail-alert를
 * import하지 않도록 따로 둔다.
 */
export type AuthRateLimiter = (rule: {
    readonly key: string;
    readonly limit: number;
    readonly windowSeconds: number;
}) => Promise<boolean>;

/** `requestEmailVerification`이 주입받는 토큰 저장소, 메일 발송기와 남용 한도 포트. */
export interface RequestEmailVerificationDependencies {
    emailTokens: EmailTokenStore;
    emailDispatcher: EmailDispatcher;
    rateLimit: AuthRateLimiter;
    /** 한도 카운터를 0으로 되돌린다(새 코드를 보낼 때 확인 시도 카운터에 쓴다). */
    resetCounter: (key: string) => Promise<void>;
    /** 요청 IP의 해시 — 원본 IP는 키에도 로그에도 남지 않는다. */
    ipHash: () => Promise<string>;
}

/** 코드로 메일 본문을 만드는 빌더. */
export interface RequestEmailVerificationOptions {
    buildMessage: (code: string) => EmailMessage;
}

/**
 * 코드 요청 결과. 잘못된 이메일은 `ok: true`(`codeIssued: false`). 한도에 걸리면 코드도 메일도 없이
 * `rate_limited`다 — 가짜 성공이 아니라 명시적 오류다(주소·IP만으로 정해지므로 계정 존재 여부는 새지 않는다).
 * 메일 발송이 실패하면 `email_send_failed`다(코드는 저장돼 있다).
 */
export type RequestEmailVerificationResult =
    | { ok: true; codeIssued: true; emailDispatched: true }
    | { ok: true; codeIssued: false; emailDispatched: false }
    | { ok: false; reason: 'rate_limited' | 'email_send_failed' };

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

/** `verifyEmail`이 주입받는 토큰 저장소와 남용 한도 포트. */
export interface VerifyEmailDependencies {
    emailTokens: EmailTokenStore;
    rateLimit: AuthRateLimiter;
    /** 요청 IP의 해시. */
    ipHash: () => Promise<string>;
}

/** 인증 코드 확인 결과. */
export type VerifyEmailResult =
    | {
          ok: true;
          /** 인증한 브라우저의 쿠키에 심을 무작위 값(원문). 해시만 마커에 저장된다. */
          bindingToken: string;
      }
    | { ok: false; error: VerifyEmailError };
