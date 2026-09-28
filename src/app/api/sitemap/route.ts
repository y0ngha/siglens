import { maxLastModified } from '@/entities/sitemap-entry/lib/maxLastModified';
import { type SitemapIndexEntry } from '@/entities/sitemap-entry/model';
import { toSitemapIndexXml } from '@/entities/sitemap-entry/lib/xml';
import {
    loadCryptoChildEntries,
    loadPopularChildEntries,
    loadStaticChildEntries,
} from '@/app/api/sitemap/_shared/childEntries';
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
 * 자식 엔트리는 자식 라우트와 **같은 함수**(`_shared/childEntries`)로 만든다 — 입력
 * (DB 신선도·산문 게이트·백테스팅 데이터일)까지 같아야 인덱스가 광고하는 lastmod가
 * 자식 파일의 최댓값과 어긋나지 않는다. 입력 로더는 `unstable_cache`라 자식 라우트와
 * 같은 캐시 항목을 재사용하고, 빌더는 순수 함수라 최댓값만 뽑고 버린다.
 */
export async function GET(request: Request): Promise<Response> {
    const aiHostRejection = rejectAiHost(request);
    if (aiHostRejection) return aiHostRejection;
    const now = new Date();
    const [staticEntries, popularEntries, cryptoEntries] = await Promise.all([
        loadStaticChildEntries(now),
        loadPopularChildEntries(now),
        loadCryptoChildEntries(now),
    ]);

    const entries: SitemapIndexEntry[] = [
        {
            url: `${SITE_URL}/sitemap-static.xml`,
            lastModified: maxLastModified(staticEntries, now),
        },
        {
            url: `${SITE_URL}/sitemap-popular.xml`,
            lastModified: maxLastModified(popularEntries, now),
        },
        {
            url: `${SITE_URL}/sitemap-crypto.xml`,
            lastModified: maxLastModified(cryptoEntries, now),
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
