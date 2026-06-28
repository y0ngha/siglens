import type { NextConfig } from 'next';
import bundleAnalyzer from '@next/bundle-analyzer';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const withBundleAnalyzer = bundleAnalyzer({
    enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
    // self-host: Docker 최소 번들(.next/standalone + server.js)
    output: 'standalone',

    // ISR/fetch 캐시를 S3로 외부화(디스크풀 방지). production + 버킷 설정 시에만 등록.
    // dev/E2E(버킷 없음)는 기본 파일시스템 캐시로 동작.
    cacheHandler:
        process.env.NODE_ENV === 'production' && process.env.ISR_CACHE_BUCKET
            ? require.resolve('./cache-handler/index.mjs')
            : undefined,
    // 멀티 인스턴스 정합성: 인스턴스 로컬 L1 캐시를 끄고 모든 read/write를 핸들러로.
    cacheMaxMemorySize: 0,

    // ⚠️ next/image 최적화 캐시(IMAGE kind)는 디스크에 유지한다(정적 에셋이라 작음, ~8KB).
    // images.customCacheHandler를 true로 켜지 말 것 — IMAGE까지 S3로 보내면 불필요한
    // 비용/복잡도만 늘고 디스크풀과 무관하다(외부화 대상에서 의도적 제외, spec §4.2).

    // serverExternalPackages 부재는 의도된 것(L3) — 다시 추가하지 말 것.
    // 과거 'postgres'를 serverExternalPackages에 넣었다가 E2E prod build가 깨졌다:
    // 정적 페이지 prerender 중 clientTest(postgres)가 실제 실행되는데 external 처리로
    // 번들에서 빠져 빌드가 실패(MEMORY: e2e_prerender_executes_clienttest 참고).
    // 프로덕션 DB는 Neon HTTP 드라이버(@neondatabase/serverless)를 쓰므로 네이티브
    // postgres를 external로 분리할 이유 자체가 없다. external 후보가 생기면 반드시
    // `E2E_TEST=1 yarn build`로 검증한 뒤에만 추가한다.

    // 압축은 CloudFlare가 brotli로 엣지에서 수행 → Next의 gzip 이중압축 방지
    compress: false,

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
    //
    // sitemap index 분할로 sub-sitemap도 일관된 외부 경로(/sitemap-*.xml)로
    // 노출한다 — sitemap index에서 노출하는 sub-sitemap URL과 실제 라우트가
    // 일치해야 crawler가 정상 fetch.
    rewrites: async () => [
        { source: '/sitemap.xml', destination: '/api/sitemap' },
        { source: '/sitemap-static.xml', destination: '/api/sitemap/static' },
        { source: '/sitemap-popular.xml', destination: '/api/sitemap/popular' },
        { source: '/sitemap-crypto.xml', destination: '/api/sitemap/crypto' },
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
