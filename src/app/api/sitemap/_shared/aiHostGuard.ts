import { constants } from 'node:http2';
import { isAiHost } from '@/shared/config/aiHost';

const { HTTP_STATUS_NOT_FOUND } = constants;

/**
 * SIGLENS AI(ai.siglens.io) 호스트는 sitemap 자체가 없다 — 전 라우트가 404.
 * 각 sitemap `GET`의 첫 줄에서 호출해 조기 반환한다.
 */
export function rejectAiHost(request: Request): Response | null {
    return isAiHost(request.headers.get('host'))
        ? new Response(null, { status: HTTP_STATUS_NOT_FOUND })
        : null;
}
