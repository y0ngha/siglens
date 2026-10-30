/** 같은 이메일의 비밀번호 재설정·이메일 인증 토큰이 Redis 키에서 충돌하지 않게 가르는 용도 태그. */
export type EmailTokenPurpose = 'password_reset' | 'email_verification';

/**
 * Redis에 저장되는 email-token 값. `pending`은 토큰 발급 상태로, 검증 때 상수 시간 비교를 하도록
 * `tokenHash`만 저장한다. `verified`는 이메일 인증 플로우 전용 표식으로, 이후 가입 시 코드를 다시
 * 묻지 않고 소유 확인을 이어가게 한다.
 */
export type EmailTokenValue =
    | { status: 'pending'; tokenHash: string }
    | { status: 'verified' };

/**
 * Redis 기반 email-token KV store. 키는 구현체가 (purpose, email)에서 파생한다.
 * 인증·가입·비밀번호 재설정 유스케이스가 주입받아 쓴다.
 */
export interface EmailTokenStore {
    /** (purpose, email)에 value를 TTL과 함께 저장 (덮어쓰기). */
    set(
        purpose: EmailTokenPurpose,
        email: string,
        value: EmailTokenValue,
        ttlSeconds: number
    ): Promise<void>;

    /** (purpose, email) 값을 읽거나, 없거나 만료 시 null. */
    get(
        purpose: EmailTokenPurpose,
        email: string
    ): Promise<EmailTokenValue | null>;

    /** (purpose, email) 항목 삭제 — 없으면 no-op. */
    delete(purpose: EmailTokenPurpose, email: string): Promise<void>;

    // 단일 사용 토큰(비밀번호 재설정 등) 재사용 방지를 위해 동시 caller 중 단 하나만
    // non-null을 받도록 atomic read+delete 보장 필수.
    /** (purpose, email)을 atomic하게 읽고 삭제 — 사전 값 또는 null 반환. */
    consume(
        purpose: EmailTokenPurpose,
        email: string
    ): Promise<EmailTokenValue | null>;
}
