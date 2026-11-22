import { hashEmailToken } from './tokenUtils';

/**
 * 비밀번호 재설정·로그인 한도 카운터 키. 확정(`confirmPasswordReset`)이 로그인 잠금을 풀려면 로그인과 같은
 * 키를 만들어야 하므로 한 파일에 둔다. 키에는 주소 원문이 아니라 SHA-256 해시만 둔다(`hashEmailToken`).
 */

export function passwordResetIpHourKey(ipHash: string): string {
    return `auth:reset-req:ip:h:${ipHash}`;
}

export function passwordResetIpDayKey(ipHash: string): string {
    return `auth:reset-req:ip:d:${ipHash}`;
}

export function passwordResetCooldownKey(emailHash: string): string {
    return `auth:reset-req:e:cd:${emailHash}`;
}

export function passwordResetEmailHourKey(emailHash: string): string {
    return `auth:reset-req:e:h:${emailHash}`;
}

export function passwordResetEmailDayKey(emailHash: string): string {
    return `auth:reset-req:e:d:${emailHash}`;
}

export function passwordResetConfirmIpKey(ipHash: string): string {
    return `auth:reset-confirm:ip:${ipHash}`;
}

export function loginIpKey(ipHash: string): string {
    return `auth:login:ip:${ipHash}`;
}

export function loginIpDayKey(ipHash: string): string {
    return `auth:login:ip:d:${ipHash}`;
}

/** 주소+IP 쌍 키. 두 해시를 다시 해시해 키 길이를 고정한다. */
export function loginEmailIpKey(emailHash: string, ipHash: string): string {
    return `auth:login:ei:${hashEmailToken(`${emailHash}:${ipHash}`)}`;
}

export function loginEmailKey(emailHash: string): string {
    return `auth:login:e:${emailHash}`;
}
