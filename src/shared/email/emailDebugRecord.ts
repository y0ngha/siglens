import type { EmailMessage } from './types';

/**
 * E2E 스펙이 읽는 `email_debug:{recipient}` Redis 값의 모양. E2eEmailDispatcher가
 * 쓰고 `e2e/support/emailHelper.ts`가 같은 모양으로 읽는다.
 */
export interface EmailDebugRecord {
    /** 인증 메일에서 뽑은 6자리 코드. */
    code?: string;
    /** 비밀번호 재설정 링크의 `token=` 쿼리에서 뽑은 토큰. */
    token?: string;
    /** 스펙이 직접 파싱할 수 있도록 남기는 plain-text 본문 전체. */
    raw: string;
}

/** Redis에 캡처 결과를 쓰는 키의 prefix. `e2e/support/emailHelper.ts`와 같은 문자열이어야 한다. */
const EMAIL_DEBUG_KEY_PREFIX = 'email_debug';

// `인증 코드: 482917` 형태의 라벨을 기준으로 잡아 무관한 숫자열을 피하고,
// `\b`로 정확히 6자리만 허용한다.
const VERIFICATION_CODE_RE = /인증\s*코드[:：]?\s*(\d{6})\b/;

// 라벨 매치가 실패했을 때만 쓰는 대체 패턴 — 단독 6자리 숫자열.
const ANY_SIX_DIGIT_RE = /\b(\d{6})\b/;

// 재설정 링크(`/reset-password?email=...&token=...`)의 raw 토큰. 값은 URL 인코딩돼 있다.
const RESET_TOKEN_RE = /[?&]token=([^&\s"']+)/;

/** 수신자별 debug Redis 키 — 쓰는 쪽(E2eEmailDispatcher)과 읽는 쪽(E2E 스펙)이 공유하는 형식. */
export function buildEmailDebugKey(recipient: string): string {
    return `${EMAIL_DEBUG_KEY_PREFIX}:${recipient}`;
}

/**
 * 렌더된 메일에서 인증 코드와 재설정 토큰을 추출한다. 있는 필드만 채우며
 * `raw`는 항상 plain-text 본문이다. 잘못된 %-인코딩이면 URIError 대신 원본
 * 매치 값을 써서 발송 도중 던지지 않는다.
 */
export function extractEmailDebugRecord(
    message: EmailMessage
): EmailDebugRecord {
    const haystack = `${message.text}\n${message.html}`;
    const tokenMatch = haystack.match(RESET_TOKEN_RE);
    const codeMatch =
        haystack.match(VERIFICATION_CODE_RE) ??
        haystack.match(ANY_SIX_DIGIT_RE);

    return {
        raw: message.text,
        ...(tokenMatch ? { token: decodeTokenSafely(tokenMatch[1]) } : {}),
        ...(codeMatch ? { code: codeMatch[1] } : {}),
    };
}

function decodeTokenSafely(encoded: string): string {
    try {
        return decodeURIComponent(encoded);
    } catch {
        return encoded;
    }
}
