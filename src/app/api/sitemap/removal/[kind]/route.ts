import { constants } from 'node:http2';
import { NextResponse } from 'next/server';

import { isRemovalSitemapKind } from '@/entities/sitemap-entry/model';

import { SITEMAP_CACHE_CONTROL } from '@/app/api/sitemap/_shared/constants';
import { rejectAiHost } from '@/app/api/sitemap/_shared/aiHostGuard';

interface RouteContext {
    params: Promise<{ kind: string }>;
}

const { HTTP_STATUS_GONE, HTTP_STATUS_NOT_FOUND } = constants;

const REMOVAL_SITEMAP_RETIRED_BODY = 'Removal sitemap retired';

export const dynamic = 'force-dynamic';

/**
 * 임시 제거 sitemap(`/sitemap-removal-{kind}.xml`)은 **은퇴했다 — 410 Gone**이다
 * (`longtail/[page]/route.ts`와 같은 방식).
 *
 * 이 sitemap은 `SEO_RECOVERY_2026_09.md` §8이 금지한 "82K 롱테일 재발견"을 계속 먹이는 표면이다 —
 * 제거 대상 URL 수만 개를 sitemap으로 계속 내보내 크롤러가 그 URL들을 다시 발견·재방문하게 만든다.
 * 재제출이 필요해지더라도 지금 목록이 아니라 **좁힌 목록**이어야 하므로, 현재 콘텐츠를 그대로
 * 재사용할 일이 없다. 응답을 내리면 검색 엔진은 sitemap 제출 항목을 정리하고(Search Console의
 * 제출 삭제는 사용자 몫), 410은 "영구히 없음"이라 재시도도 줄인다.
 *
 * **빌더(`loadRemovalSitemapEntries`·`buildRemovalEntries`·`toRemovalUrlSetXml`)는 지우지
 * 않는다** — 좁힌 목록으로 다시 열 때 이 라우트만 되살리면 된다. 알 수 없는 kind는 원래대로 404다.
 */
export async function GET(
    request: Request,
    { params }: RouteContext
): Promise<Response> {
    const aiHostRejection = rejectAiHost(request);
    if (aiHostRejection) return aiHostRejection;
    const { kind } = await params;

    if (!isRemovalSitemapKind(kind)) {
        return new NextResponse(null, { status: HTTP_STATUS_NOT_FOUND });
    }

    return new NextResponse(REMOVAL_SITEMAP_RETIRED_BODY, {
        status: HTTP_STATUS_GONE,
        headers: {
            'Cache-Control': SITEMAP_CACHE_CONTROL,
        },
    });
}
