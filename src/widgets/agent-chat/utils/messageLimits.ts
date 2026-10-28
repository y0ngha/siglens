/**
 * 사용자 메시지 길이 한도 — 입력창과 메시지 편집이 같은 한도를 쓴다(서버도 같은 값을 거부한다).
 */

/** 한 메시지의 최대 글자 수. */
export const MESSAGE_MAX_CHARS = 4_000;

/** 보낼 수 있는 메시지인가 — 앞뒤 공백을 뺀 내용이 있고 한도 안이다. */
export function isSendableMessage(text: string): boolean {
    const trimmed = text.trim();
    return trimmed.length > 0 && text.length <= MESSAGE_MAX_CHARS;
}
