import { buildSkillMarkdown } from '@/entities/siglens-api-key/lib/buildSkillMarkdown';
import { SITE_URL } from '@/shared/lib/seo';
import { apiError, API_STATUS, withApiErrorBoundary } from '../apiResponse';
import { publicApiToolSpecs } from '../publicApiTools';

export const dynamic = 'force-dynamic';

/**
 * `GET /api/v1/skill` — SKILL.md. 인증이 없다: 계정 화면의 "Skill 내려받기"가 브라우저
 * 링크로 받기 때문이고(Bearer 헤더를 못 싣는다), 내용은 공개 도구 스펙과 사용법뿐 비밀이
 * 없다. 도구 목록은 `/api/v1/tools`와 같은 소스(`publicApiToolSpecs`)에서 만든다.
 */
export async function GET(): Promise<Response> {
    return withApiErrorBoundary('skill', async () => {
        try {
            const markdown = buildSkillMarkdown({
                baseUrl: SITE_URL,
                tools: publicApiToolSpecs(),
            });
            return new Response(markdown, {
                headers: {
                    'Content-Type': 'text/markdown; charset=utf-8',
                    'Cache-Control': 'no-store',
                },
            });
        } catch (error) {
            console.error('[api/v1/skill] generation failed:', error);
            return apiError(
                API_STATUS.internalError,
                'internal_error',
                'Could not generate the skill file.'
            );
        }
    });
}
