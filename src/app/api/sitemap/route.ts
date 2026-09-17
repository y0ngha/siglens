import {
    buildCryptoPopularEntries,
    buildPopularEntries,
    buildStaticEntries,
    maxLastModified,
    type SitemapIndexEntry,
    toSitemapIndexXml,
} from '@/entities/sitemap-entry';
import { loadStaticSitemapInputs } from '@/entities/sitemap-entry/server';
import { SITE_URL } from '@/shared/lib/seo';
import { NextResponse } from 'next/server';
import { SITEMAP_CACHE_CONTROL } from '@/app/api/sitemap/_shared/constants';
import { rejectAiHost } from '@/app/api/sitemap/_shared/aiHostGuard';

export const dynamic = 'force-dynamic';

/**
 * Sitemap index.
 *
 * 각 자식 sitemap의 `lastmod`는 **그 sitemap이 실제로 담고 있는 엔트리 중 가장 최근
 * lastmod**다. 예전에는 셋 다 요청 시각(`now`)을 썼는데, 이 라우트가 `force-dynamic`
 * 이라 크롤러가 가져갈 때마다 "자식 셋이 방금 전부 바뀌었다"고 말하게 된다.
 * 인덱스 lastmod의 유일한 용도가 "이 자식을 다시 열어볼 가치가 있나" 판단인데
 * 그 신호를 무력화하는 셈이라, 자식을 실제로 만들어서 최댓값을 취한다.
 *
 * 자식 빌더는 전부 순수 함수라 여기서 한 번 더 호출해도 I/O가 없다(popular 2천여
 * 엔트리 객체 생성이 전부). 최댓값만 뽑고 버린다. static 빌더가 받는 DB 입력만
 * 예외인데, 그쪽은 `unstable_cache`라 static 라우트와 같은 항목을 재사용한다.
 */
export async function GET(request: Request): Promise<Response> {
    const aiHostRejection = rejectAiHost(request);
    if (aiHostRejection) return aiHostRejection;
    const now = new Date();
    // static 자식과 **같은 입력**으로 만들어야 인덱스가 광고하는 lastmod와 자식
    // 파일의 최댓값이 어긋나지 않는다(같은 `unstable_cache` 항목을 공유한다).
    const staticInputs = await loadStaticSitemapInputs();

    const entries: SitemapIndexEntry[] = [
        {
            url: `${SITE_URL}/sitemap-static.xml`,
            lastModified: maxLastModified(
                buildStaticEntries(now, staticInputs),
                now
            ),
        },
        {
            url: `${SITE_URL}/sitemap-popular.xml`,
            lastModified: maxLastModified(buildPopularEntries(now), now),
        },
        {
            url: `${SITE_URL}/sitemap-crypto.xml`,
            lastModified: maxLastModified(buildCryptoPopularEntries(now), now),
        },
    ];

    const xml = toSitemapIndexXml(entries);
    return new NextResponse(xml, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': SITEMAP_CACHE_CONTROL,
        },
    });
}
