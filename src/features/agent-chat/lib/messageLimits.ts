/**
 * 사용자 메시지의 보낼 수 있는 조건 — 입력창·메시지 편집(클라이언트)과 채팅 스트림 라우트(서버)가 이
 * 한 규칙을 함께 쓴다. 따로 두면 한쪽만 바뀌어 클라이언트는 보내라 하고 서버는 `invalid_body`로
 * 거부하는 상태가 생긴다.
 */

/** 한 메시지의 최대 글자 수(앞뒤 공백을 뺀 길이). */
export const MESSAGE_MAX_CHARS = 4_000;

/** 보낼 수 있는 메시지인가 — 앞뒤 공백을 뺀 내용이 있고, 그 길이가 한도 안이다(서버도 다듬은 뒤 잰다). */
export function isSendableMessage(text: string): boolean {
    const trimmed = text.trim();
    return trimmed.length > 0 && trimmed.length <= MESSAGE_MAX_CHARS;
}
