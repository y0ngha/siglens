import type { Tier } from '@y0ngha/siglens-core';

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
