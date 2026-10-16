import { toYaml } from '@/shared/lib/toYaml';
import {
    apiError,
    API_STATUS,
    PUBLIC_API_DOC_ROBOTS_HEADERS,
    withApiErrorBoundary,
} from '../apiResponse';
import {
    buildPublicOpenApiDocument,
    OPENAPI_CACHE_CONTROL,
    OPENAPI_CORS_HEADERS,
} from '../openApiDocument';

export const dynamic = 'force-dynamic';

/** `GET /api/v1/openapi.yaml` — `openapi.json`과 같은 문서의 YAML 표기. 캐시·CORS 근거도 그쪽과 같다. */
export async function GET(): Promise<Response> {
    return withApiErrorBoundary('openapi.yaml', async () => {
        // `/api/v1/skill`과 같은 모양: 생성 실패만 따로 기록해 일반 500 봉투로 바꾼다(바깥 경계는 그 밖의 예기치 못한 throw용).
        try {
            return new Response(toYaml(buildPublicOpenApiDocument()), {
                headers: {
                    'Content-Type': 'application/yaml; charset=utf-8',
                    'Cache-Control': OPENAPI_CACHE_CONTROL,
                    ...OPENAPI_CORS_HEADERS,
                    ...PUBLIC_API_DOC_ROBOTS_HEADERS,
                },
            });
        } catch (error) {
            console.error('[api/v1/openapi.yaml] generation failed:', error);
            return apiError(
                API_STATUS.internalError,
                'internal_error',
                'Could not generate the OpenAPI document.',
                {
                    headers: {
                        ...OPENAPI_CORS_HEADERS,
                        ...PUBLIC_API_DOC_ROBOTS_HEADERS,
                    },
                }
            );
        }
    });
}
