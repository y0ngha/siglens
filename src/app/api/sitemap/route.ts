import {
    buildCryptoPopularEntries,
    buildPopularEntries,
    buildStaticEntries,
    maxLastModified,
    type SitemapIndexEntry,
    toSitemapIndexXml,
} from '@/entities/sitemap-entry';
import { SITE_URL } from '@/shared/lib/seo';
import { NextResponse } from 'next/server';
import { SITEMAP_CACHE_CONTROL } from '@/app/api/sitemap/_shared/constants';

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
 * 엔트리 객체 생성이 전부). 최댓값만 뽑고 버린다.
 */
export async function GET(): Promise<Response> {
    const now = new Date();

    const entries: SitemapIndexEntry[] = [
        {
            url: `${SITE_URL}/sitemap-static.xml`,
            lastModified: maxLastModified(buildStaticEntries(now), now),
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
