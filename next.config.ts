import type { NextConfig } from 'next';

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

    // cacheComponents (Next.js 16 PPR + 'use cache' directive)는 임시 비활성.
    // 활성 상태에서 모든 [symbol] 라우트가 "Couldn't find all resumable slots"
    // 에러로 client fallback rendering으로 떨어져 SEO bot이 metadata를 못 보는
    // 문제가 발생했음(이슈 #439 참조). 표준 SSR로 임시 회귀 후 root cause
    // 진단 + 안전한 fix가 마련되면 재활성화. 재활성화 시 options-market-open
    // (stale 1m / revalidate 5m / expire 30m), options-market-closed
    // (5m / 30m / 2h), options-weekend (1h / 6h / 1d) cacheLife profile도
    // 함께 부활시킬 것.

    // Turbopack (Next.js 16 기본값이나 명시)
    turbopack: {
        root: import.meta.dirname,
    },

    // /sitemap.xml을 API Route Handler로 리라이트.
    // app/sitemap.ts 메타데이터 파일이 [symbol] 다이나믹 라우트에 우선순위를 뺏기는
    // Next.js 16 버그 회피 — 리라이트는 라우팅보다 먼저 실행되어 [symbol] 간섭 불가.
    rewrites: async () => [
        { source: '/sitemap.xml', destination: '/api/sitemap' },
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

export default nextConfig;
