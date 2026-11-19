import 'server-only';

import { getCurrentUser } from '@/entities/auth/server/getCurrentUser';
import { DrizzleChatConversationRepository } from '@/entities/chat-conversation/api';
import { getDatabaseClient } from '@/shared/db/client';

export const dynamic = 'force-dynamic';

/**
 * 이미지 행은 불변이지만 소유자 검사가 응답마다 필요하다 — `max-age`로 보관하면 로그아웃·계정 전환 뒤에도 브라우저가
 * 검사 없이 내준다. 그래서 매번 재검증(`no-cache`)시키고, 소유 확인을 통과한 뒤 `If-None-Match`가 맞으면 바이트 없이
 * 304로 답한다. `private`이라 공유 캐시(CDN)에는 올라가지 않는다.
 */
const IMAGE_CACHE_CONTROL = 'private, no-cache';

/** 행이 불변이고 id가 유일하므로 id 자체가 강한 ETag다. */
const etagFor = (id: string): string => `"${id}"`;

/** `If-None-Match`는 목록·`W/` 접두·`*`가 올 수 있다 — 약한 비교로 하나라도 맞으면 참이다. */
const matchesEtag = (header: string | null, etag: string): boolean =>
    header !== null &&
    header
        .split(',')
        .map(token => token.trim().replace(/^W\//, ''))
        .some(token => token === '*' || token === etag);

const notFound = (): Response => new Response(null, { status: 404 });

/**
 * `GET /api/ai/chat/images/<id>` — 대화에 첨부한 이미지(서버가 정규화한 WebP)를 소유자에게만 준다.
 * 비로그인·타인의 이미지·없는 id·형식이 틀린 id는 모두 같은 404라 이미지의 존재 여부가 드러나지 않는다.
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
    const user = await getCurrentUser();
    if (user === null) return notFound();
    const { id } = await params;
    const image = await new DrizzleChatConversationRepository(
        getDatabaseClient().db
    ).findImageWithOwner(id);
    if (image === null || image.ownerId !== user.id) return notFound();
    const etag = etagFor(id);
    // 소유 확인을 통과한 뒤에만 304를 준다 — 타인은 ETag가 맞아도 위에서 404다.
    if (matchesEtag(request.headers.get('If-None-Match'), etag))
        return new Response(null, {
            status: 304,
            headers: { ETag: etag, 'Cache-Control': IMAGE_CACHE_CONTROL },
        });
    return new Response(new Uint8Array(image.data), {
        headers: {
            ETag: etag,
            'Content-Type': image.mediaType,
            'Cache-Control': IMAGE_CACHE_CONTROL,
            'Content-Length': String(image.data.byteLength),
            'X-Content-Type-Options': 'nosniff',
        },
    });
}
