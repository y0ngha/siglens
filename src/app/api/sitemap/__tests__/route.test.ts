// XML 직렬화만 스텁하고 나머지(빌더 3종·maxLastModified)는 실제 구현을 쓴다 —
// 인덱스 lastmod가 "자식 sitemap 안의 최댓값"인지 검증하려면 진짜 빌더가 필요하다.
vi.mock('@/entities/sitemap-entry', async importOriginal => ({
    ...(await importOriginal<typeof import('@/entities/sitemap-entry')>()),
    toSitemapIndexXml: vi
        .fn()
        .mockReturnValue('<?xml version="1.0"?><sitemapindex/>'),
}));
// SITE_URL만 고정하고 나머지(SITE_BUILD_DATE, SITE_NAME 등)는 실제 값을 쓴다 —
// 실제 buildStaticEntries와 legal.ts가 같은 모듈의 다른 심볼을 필요로 한다.
vi.mock('@/shared/lib/seo', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/lib/seo')>()),
    SITE_URL: 'https://siglens.io',
}));

import { GET } from '@/app/api/sitemap/route';
import {
    buildCryptoPopularEntries,
    buildPopularEntries,
    buildStaticEntries,
    maxLastModified,
    toSitemapIndexXml,
} from '@/entities/sitemap-entry';
import type { MockedFunction } from 'vitest';

import nextConfig from '../../../../../next.config';

const mockToSitemapIndexXml = toSitemapIndexXml as MockedFunction<
    typeof toSitemapIndexXml
>;

describe('GET /api/sitemap (index)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('when the permanent sitemap index is requested', () => {
        it('returns XML with correct content-type and cache headers', async () => {
            const res = await GET();

            expect(res.headers.get('Content-Type')).toBe(
                'application/xml; charset=utf-8'
            );
            expect(res.headers.get('Cache-Control')).toContain('max-age=3600');
        });

        it('passes only static, popular, and crypto sitemap entries', async () => {
            await GET();

            const entries = mockToSitemapIndexXml.mock.calls[0][0];
            expect(entries).toHaveLength(3);
            expect(entries[0].url).toBe(
                'https://siglens.io/sitemap-static.xml'
            );
            expect(entries[1].url).toBe(
                'https://siglens.io/sitemap-popular.xml'
            );
            expect(entries[2].url).toBe(
                'https://siglens.io/sitemap-crypto.xml'
            );
            expect(entries.map(entry => entry.url).join('\n')).not.toContain(
                'sitemap-longtail'
            );
            expect(entries.map(entry => entry.url).join('\n')).not.toContain(
                'sitemap-removal'
            );
        });

        /**
         * 회귀 가드: 예전에는 자식 셋 모두 `lastModified: now`였다. 이 라우트가
         * `force-dynamic`이라 크롤러가 가져갈 때마다 "자식 셋이 방금 전부 바뀌었다"고
         * 말하게 되고, 인덱스 lastmod의 유일한 용도("이 자식 다시 열어볼 가치 있나")가
         * 무력화된다. 각 자식은 자기가 담은 엔트리의 최댓값을 써야 한다.
         */
        it('각 자식 lastmod는 그 sitemap 안 엔트리의 최댓값이다 (요청 시각이 아니라)', async () => {
            const now = new Date('2026-01-01T00:00:00Z');
            await GET();

            const entries = mockToSitemapIndexXml.mock.calls[0][0];
            const expected = [
                maxLastModified(buildStaticEntries(now), now),
                maxLastModified(buildPopularEntries(now), now),
                maxLastModified(buildCryptoPopularEntries(now), now),
            ];

            entries.forEach((entry, i) => {
                expect(entry.lastModified.getTime()).toBe(
                    expected[i].getTime()
                );
            });
            // 셋 중 최소 하나는 요청 시각보다 과거여야 한다 — 전부 now면 회귀다.
            expect(
                entries.some(e => e.lastModified.getTime() < now.getTime())
            ).toBe(true);
        });
    });
});

describe('nextConfig sitemap rewrites', () => {
    describe('when temporary removal sitemaps are requested', () => {
        it('rewrites the public XML path to the removal endpoint', async () => {
            const rewrites = await nextConfig.rewrites?.();

            expect(rewrites).toContainEqual({
                source: '/sitemap-removal-:kind.xml',
                destination: '/api/sitemap/removal/:kind',
            });
        });
    });
});
