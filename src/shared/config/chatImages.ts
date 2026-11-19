/**
 * SIGLENS AI 이미지 첨부의 한도 — 입력창(클라이언트)·요청 본문 검증·저장소가 같은 값을 쓴다.
 *
 * 채팅 클라이언트 번들은 `@y0ngha/siglens-core`를 싣지 않는다(`aiChatCoreFree` 가드). 그래서 core의
 * `AGENT_IMAGES_PER_MESSAGE_MAX`를 값으로 가져오지 않고 같은 값을 여기에 둔다. 두 값이 같은지는
 * `__tests__/chatImages.test.ts`가 확인한다.
 */

/** 한 메시지에 첨부할 수 있는 이미지 수. core `AGENT_IMAGES_PER_MESSAGE_MAX`와 같다. */
export const CHAT_IMAGES_PER_MESSAGE_MAX = 4;

/** 요청 본문의 base64를 디코드한 뒤 장당 상한(바이트). 서버 정규화 전의 입력 상한이다. */
export const CHAT_IMAGE_DECODED_MAX_BYTES = 10 * 1024 * 1024;

/** 스트림 라우트가 본문을 읽기 전에 거절하는 `content-length` 상한(바이트). */
export const CHAT_REQUEST_MAX_BYTES = 16 * 1024 * 1024;

/** 클라이언트가 고른 원본 파일의 상한(바이트). 넘으면 그 파일만 거절한다. */
export const CHAT_IMAGE_SOURCE_MAX_BYTES = 25 * 1024 * 1024;

/** 서버 정규화 결과의 긴 변(px). */
export const CHAT_IMAGE_SERVER_MAX_EDGE = 1600;

/**
 * 클라이언트 축소 결과의 긴 변(px). 서버가 어차피 {@link CHAT_IMAGE_SERVER_MAX_EDGE}로 줄이므로 그보다
 * 큰 픽셀을 올려 봐야 본문만 커진다 — 4장이 {@link CHAT_REQUEST_MAX_BYTES}를 넘기지 않게 같은 값으로 맞춘다.
 */
export const CHAT_IMAGE_CLIENT_MAX_EDGE = CHAT_IMAGE_SERVER_MAX_EDGE;

/** 클라이언트 축소 결과의 JPEG 품질. */
export const CHAT_IMAGE_CLIENT_JPEG_QUALITY = 0.85;

/** 요청 본문에서 이미지 base64 외 필드(글·기록·메타)가 쓸 몫(바이트). */
export const CHAT_REQUEST_NON_IMAGE_RESERVE_BYTES = 1024 * 1024;

/**
 * 클라이언트가 인코딩한 JPEG 한 장의 상한(바이트, base64 전). 최대 장수만큼 base64로 실어도
 * {@link CHAT_REQUEST_MAX_BYTES}에서 {@link CHAT_REQUEST_NON_IMAGE_RESERVE_BYTES}를 뺀 몫에 들도록 거꾸로 셈한다
 * (base64는 3바이트를 4글자로 늘린다). 노이즈 같은 최악의 입력만 넘기며, 넘으면 그 파일만 거절한다.
 */
export const CHAT_IMAGE_CLIENT_MAX_ENCODED_BYTES =
    Math.floor(
        (CHAT_REQUEST_MAX_BYTES - CHAT_REQUEST_NON_IMAGE_RESERVE_BYTES) /
            CHAT_IMAGES_PER_MESSAGE_MAX /
            4
    ) * 3;

/** 입력창이 받는 이미지 MIME. 서버 정규화는 sharp로 실제 포맷을 다시 확인한다. */
export const CHAT_IMAGE_ACCEPT_TYPES = [
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
] as const;

/** 서버가 보관·응답하는 이미지의 MIME. */
export const CHAT_STORED_IMAGE_MEDIA_TYPE = 'image/webp';
