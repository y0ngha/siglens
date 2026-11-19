import {
    CHAT_IMAGE_ACCEPT_TYPES,
    CHAT_IMAGE_CLIENT_JPEG_QUALITY,
    CHAT_IMAGE_CLIENT_MAX_EDGE,
    CHAT_IMAGE_CLIENT_MAX_ENCODED_BYTES,
    CHAT_IMAGE_SOURCE_MAX_BYTES,
} from '@/shared/config/chatImages';
import type { ChatImageAttachment, ChatImagePayload } from '../model/types';
import { localMessageId } from './optimisticMessages';

/** `btoa`에 한 번에 넘길 바이트 수 — 인자 수 한도(콜 스택)를 넘지 않게 나눈다. */
const BASE64_CHUNK = 0x8000;

export type PrepareChatImageResult =
    | { ok: true; image: ChatImageAttachment }
    | { ok: false; reason: 'unsupported' | 'too_large' | 'unreadable' };

/** 긴 변이 `maxEdge`를 넘으면 비율을 지켜 줄인 크기, 아니면 그대로(키우지 않는다). */
export function fitWithin(
    width: number,
    height: number,
    maxEdge: number
): { width: number; height: number } {
    const longest = Math.max(width, height);
    if (longest <= maxEdge) return { width, height };
    const scale = maxEdge / longest;
    return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
    };
}

function toBase64(bytes: Uint8Array): string {
    const chunks = Array.from(
        { length: Math.ceil(bytes.length / BASE64_CHUNK) },
        (_, i) =>
            String.fromCharCode(
                ...bytes.subarray(i * BASE64_CHUNK, (i + 1) * BASE64_CHUNK)
            )
    );
    return btoa(chunks.join(''));
}

function isAcceptedType(type: string): boolean {
    return CHAT_IMAGE_ACCEPT_TYPES.some(accepted => accepted === type);
}

/**
 * 사용자가 고른 파일 한 장을 서버로 보낼 크기로 줄인다 — 긴 변 {@link CHAT_IMAGE_CLIENT_MAX_EDGE}px 이내 JPEG.
 * 본문 크기를 줄이는 용도이고 최종 검증·정규화는 서버가 한다. 한 파일의 실패는 그 파일만 거절한다
 * (`reason`으로 안내 문구를 고른다). EXIF 방향은 디코드할 때 적용되고 JPEG 재인코딩이 메타데이터를 버린다.
 * 투명 PNG는 흰 배경에 얹는다(JPEG에 알파가 없어 검게 나오기 때문).
 */
export async function prepareChatImage(
    file: File
): Promise<PrepareChatImageResult> {
    if (!isAcceptedType(file.type)) return { ok: false, reason: 'unsupported' };
    if (file.size > CHAT_IMAGE_SOURCE_MAX_BYTES)
        return { ok: false, reason: 'too_large' };
    try {
        const bitmap = await createImageBitmap(file, {
            imageOrientation: 'from-image',
        });
        const { width, height } = fitWithin(
            bitmap.width,
            bitmap.height,
            CHAT_IMAGE_CLIENT_MAX_EDGE
        );
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (context === null) {
            bitmap.close();
            return { ok: false, reason: 'unreadable' };
        }
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, width, height);
        context.drawImage(bitmap, 0, 0, width, height);
        bitmap.close();
        const blob = await new Promise<Blob | null>(resolve =>
            canvas.toBlob(resolve, 'image/jpeg', CHAT_IMAGE_CLIENT_JPEG_QUALITY)
        );
        if (blob === null) return { ok: false, reason: 'unreadable' };
        // 4장을 base64로 실어도 요청 상한에 드는 장당 몫 — 노이즈 같은 입력만 여기서 걸린다.
        if (blob.size > CHAT_IMAGE_CLIENT_MAX_ENCODED_BYTES)
            return { ok: false, reason: 'too_large' };
        const bytes = new Uint8Array(await blob.arrayBuffer());
        return {
            ok: true,
            image: {
                id: localMessageId('local'),
                src: URL.createObjectURL(blob),
                width,
                height,
                payload: { mediaType: 'image/jpeg', data: toBase64(bytes) },
            },
        };
    } catch {
        return { ok: false, reason: 'unreadable' };
    }
}

/** 서버가 보관한 이미지를 가리키는 조회 경로(`GET /api/ai/chat/images/<id>`). */
export function storedImageSrc(id: string): string {
    return `/api/ai/chat/images/${id}`;
}

/**
 * 요청 본문에 실을 이미지 payload. payload가 없는 이미지(저장된 대화에서 읽은 것)는 거른다 —
 * 회원의 재생성·수정은 서버가 보관한 이미지를 다시 읽으므로 본문에 싣지 않는다.
 */
export function imagePayloads(
    images: readonly ChatImageAttachment[]
): ChatImagePayload[] {
    return images.flatMap(image => (image.payload ? [image.payload] : []));
}
