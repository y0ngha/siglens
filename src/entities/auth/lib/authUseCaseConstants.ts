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
 * 가입 이메일 인증 코드의 남용 한도. 키에는 이메일·IP의 해시만 담긴다(`createEmailVerificationGuards`).
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
