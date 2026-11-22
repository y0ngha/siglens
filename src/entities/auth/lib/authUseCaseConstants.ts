import type { Tier } from '@y0ngha/siglens-core';
import {
    SECONDS_PER_DAY,
    SECONDS_PER_HOUR,
    SECONDS_PER_MINUTE,
} from '@/shared/config/time';

/**
 * 가입(이메일/비밀번호·OAuth) 시 부여하는 tier. 가입한 사용자는 member이고, 사용자 행이 없는
 * 익명 방문자는 `DrizzleUserRepository.getUserTier`를 거쳐 core의 `DEFAULT_TIER`('free')로
 * 떨어진다 — 이 상수와 무관하다. 가입 화면의 회원 혜택 목록도 이 값을 기준으로 계산한다.
 */
export const SIGNED_UP_USER_TIER: Tier = 'member';

/** @internal 가입 시 이미 있는 이메일을 만났을 때의 오류 코드. */
export const EMAIL_ALREADY_EXISTS_CODE = 'email_already_exists' as const;

/** @internal 모르는 토큰이거나 이미 소비된 비밀번호 재설정 토큰의 오류 코드. */
export const PASSWORD_RESET_INVALID_TOKEN_CODE = 'invalid_token' as const;

/** @internal 만료된 비밀번호 재설정 토큰의 오류 코드. */
export const PASSWORD_RESET_EXPIRED_TOKEN_CODE = 'expired_token' as const;

/** @internal 이메일 인증 없이 `registerUser`를 부른 경우의 오류 코드. */
export const EMAIL_NOT_VERIFIED_CODE = 'email_not_verified' as const;

/** @internal 비밀번호 재설정 토큰 수명(초) — 30분. */
export const PASSWORD_RESET_TTL_SECONDS = 30 * 60;

/** @internal 이메일 인증 `pending` 상태(코드 발송 후 입력 대기) 수명(초) — 30분. */
export const EMAIL_VERIFICATION_PENDING_TTL_SECONDS = 30 * 60;

/** @internal 이메일 인증 `verified` 마커(가입 완료 대기) 수명(초) — 30분. */
export const EMAIL_VERIFICATION_VERIFIED_TTL_SECONDS = 30 * 60;

/** @internal 비밀번호 재설정 URL-safe 토큰에 쓰는 난수 바이트 수. */
export const PASSWORD_RESET_TOKEN_BYTE_LENGTH = 32;

/** @internal 숫자 이메일 인증 코드의 자릿수. */
export const EMAIL_VERIFICATION_CODE_LENGTH = 6;

/**
 * 가입 이메일 인증 코드의 남용 한도. 키에는 이메일·IP의 해시만 담긴다(`createAuthRateLimitGuards`).
 * 알림 메일 코드 흐름(`MAIL_ALERT_RATE_LIMITS`)과 같은 구조지만 별도 상수다. 가장 긴 창(24시간)은
 * 개인정보처리방침이 적은 보관 시간과 같아야 하며, `signupVerificationPrivacy` 가드가 묶는다.
 */
export const EMAIL_VERIFICATION_RATE_LIMITS = {
    /**
     * IP(해시)당 코드 요청, 시간당. 한국 모바일 통신사는 한 IP 뒤에 사용자가 많아 알림 메일(10)보다 넉넉하게
     * 잡는다. 피해 주소를 지키는 것은 아래 주소당 한도다.
     */
    codePerIpHour: { limit: 20, windowSeconds: SECONDS_PER_HOUR },
    /** IP(해시)당 코드 요청, 하루. */
    codePerIpDay: { limit: 50, windowSeconds: SECONDS_PER_DAY },
    /** 주소(해시)당 코드 요청 간격. 연타와 메일 폭탄을 막는다. */
    codeCooldownPerEmail: { limit: 1, windowSeconds: SECONDS_PER_MINUTE },
    /** 주소(해시)당 코드 요청, 시간당. */
    codePerEmailHour: { limit: 5, windowSeconds: SECONDS_PER_HOUR },
    /** 주소(해시)당 코드 요청, 하루. 하루 추측 상한(10코드 x 5회)을 정한다. */
    codePerEmailDay: { limit: 10, windowSeconds: SECONDS_PER_DAY },
    /** IP(해시)당 코드 확인 시도. 제3자가 남의 주소 카운터를 계속 채워 두는 것을 막는다. */
    confirmPerIp: {
        limit: 30,
        windowSeconds: EMAIL_VERIFICATION_PENDING_TTL_SECONDS,
    },
    /**
     * 주소(해시)당 코드 확인 시도. 시도마다 비교 **전에** 센다(맞는 코드도 센다). 새 코드를 보내면 0으로
     * 돌아간다. 창은 대기 코드 수명과 같다.
     */
    attemptsPerEmail: {
        limit: 5,
        windowSeconds: EMAIL_VERIFICATION_PENDING_TTL_SECONDS,
    },
} as const;

/**
 * 비밀번호 재설정 요청·확정의 남용 한도. 키에는 이메일·IP의 해시만 담긴다(`authRateLimitKeys`). 요청 쪽은
 * 가입 코드 요청(`EMAIL_VERIFICATION_RATE_LIMITS`)과 같은 숫자·순서다. 한도는 DB 조회 **전에** 세고 키가
 * 입력과 IP로만 정해지므로 계정이 있는지는 응답에 드러나지 않는다. 가장 긴 창(24시간)은 개인정보처리방침이
 * 적은 보관 시간과 같아야 하며 `authAttemptLimitPrivacy` 가드가 묶는다. IP 해시는 UTC 날짜를 소금으로 쓰므로
 * (`hashUsageIp`) IP 키의 창은 00:00 UTC에 새로 시작한다.
 */
export const PASSWORD_RESET_RATE_LIMITS = {
    /** IP(해시)당 재설정 메일 요청, 시간당. */
    requestPerIpHour: { limit: 20, windowSeconds: SECONDS_PER_HOUR },
    /** IP(해시)당 재설정 메일 요청, 하루. */
    requestPerIpDay: { limit: 50, windowSeconds: SECONDS_PER_DAY },
    /** 주소(해시)당 재설정 메일 요청 간격. 연타와 메일 폭탄을 막는다. */
    requestCooldownPerEmail: { limit: 1, windowSeconds: SECONDS_PER_MINUTE },
    /** 주소(해시)당 재설정 메일 요청, 시간당. */
    requestPerEmailHour: { limit: 5, windowSeconds: SECONDS_PER_HOUR },
    /** 주소(해시)당 재설정 메일 요청, 하루. */
    requestPerEmailDay: { limit: 10, windowSeconds: SECONDS_PER_DAY },
    /**
     * IP(해시)당 재설정 확정 시도. 창은 토큰 수명과 같다. 주소별 한도는 일부러 없다: 있으면 제3자가 남의
     * 주소 카운터를 채워 주인의 링크를 죽일 수 있고, 256비트 토큰은 추측 상한이 필요 없다.
     */
    confirmPerIp: { limit: 20, windowSeconds: PASSWORD_RESET_TTL_SECONDS },
} as const;

/**
 * 이메일 로그인의 남용 한도. 시도 **전부**를 조회 전에 원자적으로 센다(맞는 비밀번호도 센다) — 실패만 세면
 * 확인 후 증가라 병렬 추측이 상한을 넘는다. 순서는 `perIp`, `perIpDay`, `perEmailIp`, `perEmail`이다.
 * 잠금은 자동 만료되는 소프트 잠금이다(주소당 한 시간에 20회, 하루 최대 480회). 제3자가 한 주소의 비밀번호
 * 로그인을 최대 1시간 막을 수 있고, 주인은 비밀번호 재설정으로 푼다(`confirmPasswordReset`). 구글 로그인은
 * 영향이 없다. 가장 긴 창(24시간)은 방침과 같아야 한다(`authAttemptLimitPrivacy`). IP 키의 창은 00:00 UTC에
 * 새로 시작한다(`hashUsageIp`).
 */
export const LOGIN_RATE_LIMITS = {
    /** IP(해시)당 로그인 시도. */
    perIp: { limit: 30, windowSeconds: 15 * SECONDS_PER_MINUTE },
    /** IP(해시)당 로그인 시도, 하루. */
    perIpDay: { limit: 200, windowSeconds: SECONDS_PER_DAY },
    /** 주소(해시)+IP(해시) 쌍당 로그인 시도. 성공하면 이 키만 지운다. */
    perEmailIp: { limit: 10, windowSeconds: 15 * SECONDS_PER_MINUTE },
    /**
     * 주소(해시)당 로그인 시도. 성공해도 지우지 않는다(지우면 주인이 로그인할 때마다 공격자가 새 예산을
     * 얻는다). 비밀번호 재설정 성공만 지운다.
     */
    perEmail: { limit: 20, windowSeconds: SECONDS_PER_HOUR },
} as const;

/**
 * 계정이 없거나 비밀번호가 없는 로그인 시도가 비교하는 더미 해시. 계정이 있을 때와 같은 bcrypt 비용(cost 12)을
 * 치르게 해 응답 시간으로 계정 유무를 가리지 못하게 한다. 반드시 **진짜** cost-12 해시여야 한다: bcryptjs는
 * 형식이 깨진 해시에 즉시 false를 돌려주므로 모양만 흉내 낸 문자열은 비용을 치르지 않는다.
 * 무작위 32바이트(hex)를 cost 12로 해시한 값이며 어떤 비밀번호와도 대응하지 않는다.
 */
export const LOGIN_TIMING_DUMMY_HASH =
    '$2b$12$Ph08QygKxn9bAJUn4eSe6u9yeDs7w6Pba84lLgJUVz/SgguNNOI1G';
