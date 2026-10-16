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

/**
 * `GET /api/v1/openapi.json` — OpenAPI 3.1 문서. 인증이 없다(`/api/v1/skill`과 같은 이유: 브라우저 링크로
 * 받고, 내용은 공개 도구 스펙과 사용법뿐이다). `Access-Control-Allow-Origin: *`는 이 공개 문서에만 건다 —
 * 브라우저 기반 도구(Swagger Editor 등)가 읽을 수 있게 하는 것이고, 인증이 필요한 v1 응답에는 CORS를 열지 않는다.
 */
export async function GET(): Promise<Response> {
    return withApiErrorBoundary('openapi.json', async () => {
        // `/api/v1/skill`과 같은 모양: 생성 실패만 따로 기록해 일반 500 봉투로 바꾼다(바깥 경계는 그 밖의 예기치 못한 throw용).
        try {
            return Response.json(buildPublicOpenApiDocument(), {
                headers: {
                    'Cache-Control': OPENAPI_CACHE_CONTROL,
                    ...OPENAPI_CORS_HEADERS,
                    ...PUBLIC_API_DOC_ROBOTS_HEADERS,
                },
            });
        } catch (error) {
            console.error('[api/v1/openapi.json] generation failed:', error);
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
