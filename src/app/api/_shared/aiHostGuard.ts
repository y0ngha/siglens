import { constants } from 'node:http2';
import { isAiHost } from '@/shared/config/aiHost';

const { HTTP_STATUS_NOT_FOUND } = constants;

/**
 * SIGLENS AI(ai.siglens.io) 호스트는 sitemap·RSS·공포탐욕 데이터 등 SEO용 공개
 * 라우트가 전부 404다. 각 `GET`의 첫 줄에서 호출해 조기 반환한다.
 */
export function rejectAiHost(request: Request): Response | null {
    return isAiHost(request.headers.get('host'))
        ? new Response(null, { status: HTTP_STATUS_NOT_FOUND })
        : null;
}
