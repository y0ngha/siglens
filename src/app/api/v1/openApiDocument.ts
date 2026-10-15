import {
    buildOpenApiDocument,
    type OpenApiDocument,
} from '@/entities/siglens-api-key/lib/buildOpenApiDocument';
import { SITE_URL } from '@/shared/lib/seo';
import { publicApiToolSpecs } from './publicApiTools';

/**
 * 공개 OpenAPI 문서 헤더. 인증이 없고 내용이 도구 목록·상수뿐이라 공유 캐시가 가진 사본이
 * 문제 될 일이 없다 — 다른 v1 응답(`no-store`)과 달리 공개 캐시를 허용한다. 도구가 바뀌는 것은 배포
 * 때뿐이므로 `s-maxage`는 길게, 브라우저는 짧게 둔다(`stale-while-revalidate`로 만료 순간의 지연을 숨긴다).
 */
export const OPENAPI_CACHE_CONTROL =
    'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400';

/**
 * 공개 문서에만 거는 CORS — 브라우저 기반 도구(Swagger Editor 등)가 읽을 수 있게 한다. 인증이 필요한 v1 응답에는
 * 열지 않는다. **오류 응답에도 같이 건다**: 헤더가 없으면 브라우저가 5xx 본문을 숨기고 CORS 오류로만 보인다.
 */
export const OPENAPI_CORS_HEADERS: Readonly<Record<string, string>> = {
    'Access-Control-Allow-Origin': '*',
};

/**
 * 도구 목록은 SKILL.md·`GET /tools`와 같은 소스(`publicApiToolSpecs`)다 — 이 문서만 따로 목록을 들지 않는다.
 */
export function buildPublicOpenApiDocument(): OpenApiDocument {
    return buildOpenApiDocument({
        baseUrl: SITE_URL,
        tools: publicApiToolSpecs(),
    });
}
