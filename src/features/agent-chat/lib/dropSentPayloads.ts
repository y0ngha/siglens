import type { AgentUiMessage, ChatImageAttachment } from '../model/types';

const withoutPayload = (image: ChatImageAttachment): ChatImageAttachment => {
    const { payload: _dropped, ...rest } = image;
    return rest;
};

/**
 * 턴이 끝난 뒤 이미 보낸 이미지의 base64 `payload`를 메시지 상태에서 덜어 낸다 — 장당 최대 수 MB 문자열이 세션 내내
 * 메모리에 남지 않게 한다. 회원은 재생성·수정이 서버가 보관한 이미지를 다시 읽으므로 전부 덜어 내고, 게스트는 서버에
 * 이미지가 없어 재생성이 마지막 질문을 다시 보내므로 **마지막 사용자 메시지**의 payload만 남긴다.
 * 덜어낼 것이 없는 메시지는 같은 참조로 돌려준다(불필요한 리렌더를 막는다).
 */
export function dropSentPayloads(
    messages: AgentUiMessage[],
    guest: boolean
): AgentUiMessage[] {
    const keepIndex = guest
        ? messages.findLastIndex(m => m.role === 'user')
        : -1;
    return messages.map((message, index) => {
        if (index === keepIndex) return message;
        if (!message.images?.some(image => image.payload !== undefined))
            return message;
        return { ...message, images: message.images.map(withoutPayload) };
    });
}
