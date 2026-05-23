import type { NextConfig } from 'next';
import bundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = bundleAnalyzer({
    enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
    allowedDevOrigins: ['172.30.1.26'],

    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'lh3.googleusercontent.com',
            },
        ],
    },

    // React Compiler (Next.js 16 stable)
    reactCompiler: true,

    // streaming metadata 비활성화. Next.js 16은 generateMetadata가 async이고 layout/page에
    // async work(getAssetInfoCached, prefetchQuery(bars) 등)가 있으면 shell을 먼저 flush한 뒤
    // metadata를 body 끝에 streaming inject한다. Googlebot 등 default htmlLimitedBots 매치
    // UA는 head로 받지만 Naver Yeti, KakaoTalk 등 매치되지 않는 봇은 body에서 OG/canonical을
    // 못 읽어 SNS 미리보기·검색 시그널이 깨진다. /.*/로 모든 UA를 blocking 경로로 강제해
    // metadata가 항상 head에 박히도록 보장. TTFB가 generateMetadata 완료 시점까지 늦춰지지만,
    // 우리 generateMetadata는 cached getAssetInfoCached + 문자열 빌드뿐이라 영향은 미미하다.
    htmlLimitedBots: /.*/,

    // skills/ 디렉토리는 fs.readdir로 동적 접근하므로 Vercel이 자동 추적하지 못한다.
    // 명시적으로 포함시켜 Server Actions에서 파일을 읽을 수 있도록 한다.
    outputFileTracingIncludes: {
        '/**': ['./skills/**/*'],
    },

    // cacheComponents (Next.js 16 PPR + 'use cache' directive) 재활성화.
    // next@16.2.x에서는 모든 [symbol] 라우트가 "Couldn't find all resumable
    // slots" 에러로 client fallback rendering으로 떨어져 SEO bot이 metadata를
    // 못 보는 회귀가 있어 next@16.1.2로 pin한 상태(이슈 #439). 'use cache' /
    // cacheLife / cacheTag 지시어도 함께 복구 — cacheComponents는 opt-in
    // 캐싱을 강제하므로 prerender 가능한 server component는 cache 지시어가
    // 있어야 build pass. cacheLife profile(options-market-open/closed/weekend)
    // 도입은 다음 PR로 분리. upstream resumable slots 픽스 머지 후 16.2+
    // 재진입 가능.
    cacheComponents: true,

    // Turbopack (Next.js 16 기본값이나 명시)
    turbopack: {
        root: import.meta.dirname,
    },

    // /sitemap.xml을 API Route Handler로 리라이트.
    // app/sitemap.ts 메타데이터 파일이 [symbol] 다이나믹 라우트에 우선순위를 뺏기는
    // Next.js 16 버그 회피 — 리라이트는 라우팅보다 먼저 실행되어 [symbol] 간섭 불가.
    //
    // sitemap index 분할로 sub-sitemap도 일관된 외부 경로(/sitemap-*.xml)로
    // 노출한다 — sitemap index에서 노출하는 sub-sitemap URL과 실제 라우트가
    // 일치해야 crawler가 정상 fetch.
    rewrites: async () => [
        { source: '/sitemap.xml', destination: '/api/sitemap' },
        { source: '/sitemap-static.xml', destination: '/api/sitemap/static' },
        { source: '/sitemap-popular.xml', destination: '/api/sitemap/popular' },
        {
            source: '/sitemap-longtail-:page.xml',
            destination: '/api/sitemap/longtail/:page',
        },
    ],

    headers: async () => [
        {
            source: '/(.*)',
            headers: [
                {
                    key: 'X-Content-Type-Options',
                    value: 'nosniff',
                },
                {
                    key: 'X-Frame-Options',
                    value: 'DENY',
                },
                {
                    key: 'Referrer-Policy',
                    value: 'strict-origin-when-cross-origin',
                },
                {
                    key: 'Strict-Transport-Security',
                    value: 'max-age=63072000; includeSubDomains; preload',
                },
            ],
        },
    ],
};

export default withBundleAnalyzer(nextConfig);
