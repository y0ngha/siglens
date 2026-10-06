import { NextResponse } from 'next/server';
import { DrizzleNoticeRepository } from '@/entities/notice/api';
import { getActiveNoticesMemoized } from '@/entities/notice/lib/activeNoticesMemo';
import type { NoticeWireRecord } from '@/entities/notice/model/types';
import { tryGetDatabaseClient } from '@/shared/db/client';
import { resolveLocale } from '@/shared/i18n/locales';

// 요청 URL(`?locale=`)을 읽으므로 빌드 시점에 굳을 수 없다. 캐시는 아래 `Cache-Control`로
// CDN이 맡는다.
export const dynamic = 'force-dynamic';

/**
 * 공개 캐시 헤더. 응답이 **전 방문자 공통**이고(로케일은 쿼리 문자열, 개인화 값 없음) 공지는
 * "긴급 반영"이 요건이라 길게 잡지 않는다 — 60초 + 만료 뒤 5분은 stale로 내주며 뒤에서 갱신.
 *
 * ⚠️ 현재 Cloudflare 캐시 규칙은 `/api`를 제외한다(`docs/architecture/CDN_CACHING.md` §3).
 * 그래서 `s-maxage`는 **지금은 엣지에서 효과가 없다** — `/api/notices`용 CDN 규칙이 나중에
 * 추가될 때 비로소 동작하도록 헤더만 올바르게 둔 것이다. 그 사이 오리진 DB 부하는 같은 60초
 * 창의 인스턴스 메모(`getActiveNoticesMemoized`)가 막는다.
 */
const NOTICES_CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=300';

/** 조회 실패·DB 미설정 응답은 캐시하지 않는다 — 일시 장애가 1분간 "공지 없음"으로 굳지 않게. */
const NO_STORE = { 'Cache-Control': 'no-store' } as const;

/**
 * 활성 공지 목록(`NoticeWireRecord[]`) — 우선순위/최신순.
 *
 * ## 왜 서버 액션이 아니라 GET 라우트인가 (2026-10-05 운영 크롤)
 *
 * 공지 팝업은 모든 페이지에서 마운트되는데, 예전엔 마운트 때마다 Server Action(POST)으로
 * 공지를 읽었다. 크롤러 렌더도 그 POST를 매 페이지 한 번씩 쏘았다. 이 라우트로 옮기면 그
 * 요청이 **`/api/`로 가고, `/api/`는 robots.txt에서 Googlebot에 Disallow**라 크롤러 렌더러는
 * 요청 자체를 가져가지 않는다 — 렌더마다 나가던 서버 액션 POST가 사라지는 것이 이 변경의
 * 목적이다(크롤 예산). CDN 캐시로 오리진 부하를 줄이는 효과는 현재 없다(아래 헤더 주석) —
 * 그래서 DB 조회 결과를 로케일별로 60초 메모한다(페이지 뷰마다 돌던 `findActive` + 번역 조회).
 *
 * 로케일은 요청 헤더가 아니라 `?locale=`로 받는다 — 나중에 CDN 규칙이 붙어도 캐시 키에
 * 로케일이 들어가 먼저 캐시된 언어가 다른 언어 방문자에게 가지 않는다. 알 수 없는 값은 기본
 * 로케일로 떨어진다.
 *
 * 공지는 부가 기능이라 DB 미설정·조회 실패는 빈 배열로 degrade한다(`no-store`).
 */
export async function GET(request: Request): Promise<Response> {
    const locale = resolveLocale(
        new URL(request.url).searchParams.get('locale') ?? ''
    );
    try {
        const client = tryGetDatabaseClient();
        if (client === null)
            return NextResponse.json([], { headers: NO_STORE });
        const body: NoticeWireRecord[] = await getActiveNoticesMemoized(
            locale,
            async () => {
                const notices = await new DrizzleNoticeRepository(
                    client.db
                ).findActive(locale);
                // `Date`는 JSON에서 ISO 문자열이 된다 — 클라이언트 훅이 되돌린다.
                return notices.map(notice => ({
                    ...notice,
                    createdAt: notice.createdAt.toISOString(),
                }));
            }
        );
        return NextResponse.json(body, {
            headers: { 'Cache-Control': NOTICES_CACHE_CONTROL },
        });
    } catch (err) {
        console.error('[api/notices] unexpected error:', err);
        return NextResponse.json([], { headers: NO_STORE });
    }
}
