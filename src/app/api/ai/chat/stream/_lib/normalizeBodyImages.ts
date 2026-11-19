import {
    normalizeChatImage,
    type NormalizedChatImage,
} from '@/entities/chat-conversation/server/normalizeChatImage';

/**
 * 요청 본문이 싣고 온 이미지(base64 문자열)를 디코드해 모두 정규화한다. 디코드는 여기서 — `parseBody`는 인증·한도 검사
 * 전에 돌아 버퍼를 만들지 않는다. 한 장이라도 읽지 못하면 `null`(→ 400
 * `invalid_image`) — 일부만 걸러 보내면 사용자가 올린 것과 모델이 본 것이 달라진다.
 */
export async function normalizeBodyImages(
    images: readonly string[]
): Promise<NormalizedChatImage[] | null> {
    const normalized = await Promise.all(
        images.map(data => normalizeChatImage(Buffer.from(data, 'base64')))
    );
    return normalized.every(image => image !== null) ? normalized : null;
}
