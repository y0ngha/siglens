import { AGENT_IMAGES_PER_MESSAGE_MAX } from '@y0ngha/siglens-core';
import {
    CHAT_IMAGE_CLIENT_MAX_EDGE,
    CHAT_IMAGE_CLIENT_MAX_ENCODED_BYTES,
    CHAT_IMAGE_SERVER_MAX_EDGE,
    CHAT_IMAGES_PER_MESSAGE_MAX,
    CHAT_REQUEST_MAX_BYTES,
    CHAT_REQUEST_NON_IMAGE_RESERVE_BYTES,
} from '@/shared/config/chatImages';

/** base64가 `bytes`를 싣는 글자 수(패딩 포함). */
const base64Length = (bytes: number): number => Math.ceil(bytes / 3) * 4;

describe('chatImages 상수', () => {
    it('장수 상한이 core의 AGENT_IMAGES_PER_MESSAGE_MAX와 같다', () => {
        expect(CHAT_IMAGES_PER_MESSAGE_MAX).toBe(AGENT_IMAGES_PER_MESSAGE_MAX);
    });

    it('클라이언트 축소 긴 변이 서버 정규화 긴 변보다 크지 않다', () => {
        expect(CHAT_IMAGE_CLIENT_MAX_EDGE).toBeLessThanOrEqual(
            CHAT_IMAGE_SERVER_MAX_EDGE
        );
    });

    it('최악의 인코딩 결과 최대 장수를 base64로 실어도 요청 상한에 든다', () => {
        const worstCaseImages =
            CHAT_IMAGES_PER_MESSAGE_MAX *
            base64Length(CHAT_IMAGE_CLIENT_MAX_ENCODED_BYTES);
        expect(
            worstCaseImages + CHAT_REQUEST_NON_IMAGE_RESERVE_BYTES
        ).toBeLessThanOrEqual(CHAT_REQUEST_MAX_BYTES);
    });
});
