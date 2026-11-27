import 'server-only';
import sharp from 'sharp';
import {
    CHAT_IMAGE_SERVER_MAX_EDGE,
    CHAT_STORED_IMAGE_MEDIA_TYPE,
} from '@/shared/config/chatImages';

/** 디코드할 입력 픽셀 상한(40MP). 작은 파일에 거대한 해상도를 숨긴 압축 폭탄을 막는다. */
const INPUT_PIXEL_LIMIT = 40_000_000;

/** 정규화 결과의 WebP 품질. */
const WEBP_QUALITY = 82;

/** 받아 주는 입력 포맷(sharp 메타데이터의 `format`). GIF는 첫 프레임만 쓴다. */
const ACCEPTED_FORMATS: readonly string[] = ['jpeg', 'png', 'webp', 'gif'];

/** 서버가 보관·모델에 보내는 이미지 한 장. */
export interface NormalizedChatImage {
    mediaType: typeof CHAT_STORED_IMAGE_MEDIA_TYPE;
    bytes: Buffer;
    width: number;
    height: number;
}

/**
 * 사용자가 올린 이미지를 한 가지 모양(WebP, 긴 변 1600px 이내, 메타데이터 없음)으로 맞춘다.
 *
 * - EXIF 방향을 픽셀에 먼저 적용한 뒤 메타데이터를 모두 버린다(위치 정보 등이 저장·전송되지 않는다).
 *   개인정보처리방침 v14(`db/seeds/terms/privacy/v14*.md`)가 이 처리를 약속한다. 바꾸면 방침도 같이 바꾼다.
 * - 디코드 실패·지원하지 않는 포맷·픽셀 상한 초과는 `null`이다 — 호출자가 `invalid_image`로 거절한다.
 *   이 함수는 던지지 않는다.
 */
export async function normalizeChatImage(
    input: Buffer
): Promise<NormalizedChatImage | null> {
    try {
        const source = sharp(input, {
            limitInputPixels: INPUT_PIXEL_LIMIT,
            // 애니메이션은 첫 프레임만 — 기본값(`pages: 1`)을 명시해 의도를 남긴다.
            pages: 1,
        });
        const { format } = await source.metadata();
        if (format === undefined || !ACCEPTED_FORMATS.includes(format))
            return null;
        const { data, info } = await source
            .rotate()
            .resize(CHAT_IMAGE_SERVER_MAX_EDGE, CHAT_IMAGE_SERVER_MAX_EDGE, {
                fit: 'inside',
                withoutEnlargement: true,
            })
            .webp({ quality: WEBP_QUALITY })
            .toBuffer({ resolveWithObject: true });
        return {
            mediaType: CHAT_STORED_IMAGE_MEDIA_TYPE,
            bytes: data,
            width: info.width,
            height: info.height,
        };
    } catch {
        return null;
    }
}
