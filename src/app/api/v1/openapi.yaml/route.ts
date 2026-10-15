import { toYaml } from '@/shared/lib/toYaml';
import { apiError, API_STATUS, withApiErrorBoundary } from '../apiResponse';
import {
    buildPublicOpenApiDocument,
    OPENAPI_CACHE_CONTROL,
} from '../openApiDocument';

export const dynamic = 'force-dynamic';

/** `GET /api/v1/openapi.yaml` — `openapi.json`과 같은 문서의 YAML 표기. 캐시·CORS 근거도 그쪽과 같다. */
export async function GET(): Promise<Response> {
    return withApiErrorBoundary('openapi.yaml', async () => {
        try {
            return new Response(toYaml(buildPublicOpenApiDocument()), {
                headers: {
                    'Content-Type': 'application/yaml; charset=utf-8',
                    'Cache-Control': OPENAPI_CACHE_CONTROL,
                    'Access-Control-Allow-Origin': '*',
                },
            });
        } catch (error) {
            console.error('[api/v1/openapi.yaml] generation failed:', error);
            return apiError(
                API_STATUS.internalError,
                'internal_error',
                'Could not generate the OpenAPI document.'
            );
        }
    });
}
