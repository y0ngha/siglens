/**
 * 가입 이메일 인증의 한도·카운터 키. 요청(`requestEmailVerification`)과 확인(`verifyEmail`)이 같은 키를
 * 써야 하므로 한 파일에 둔다. 키에는 주소 원문이 아니라 SHA-256 해시만 둔다(`hashEmailToken`은 같은 SHA-256 hex).
 */

/** 그 주소의 코드 확인 시도 카운터. */
export function emailVerificationAttemptsKey(emailHash: string): string {
    return `auth:signup-verify:e:${emailHash}`;
}

/** 그 주소의 코드 재요청 쿨다운(60초 창) 카운터. 발송이 실패하면 이 키만 풀어 바로 재시도하게 한다. */
export function emailVerificationCooldownKey(emailHash: string): string {
    return `auth:signup-code:e:cd:${emailHash}`;
}
