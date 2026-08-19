import type { NextConfig } from 'next';
import bundleAnalyzer from '@next/bundle-analyzer';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const withBundleAnalyzer = bundleAnalyzer({
    enabled: process.env.ANALYZE === 'true',
});

// ⚠️ TypeScript 7 + Next 16.2 조합 주의
// Next의 빌드타임 타입체크는 레거시 JS API(`typescript/lib/typescript.js`)를 require하는데,
// TypeScript 7(네이티브 Go 컴파일러)은 그 파일을 배포하지 않는다. Next는 대신
// `@typescript/native-preview`가 설치돼 있으면 "네이티브 컴파일러 사용 중"으로 인식하고
// 자기 타입체크를 건너뛴다(next/dist/lib/verify-typescript-setup.js).
// 따라서 devDependencies의 `@typescript/native-preview`는 미사용 패키지가 아니라 이 신호용이다 —
// 제거하면 `yarn build`가 "trying to use TypeScript but do not have the required package(s)"로 깨진다.
// 타입 안전성은 `yarn typecheck`(tsc --noEmit, TS7)가 pre-push + CI에서 담당한다.
const nextConfig: NextConfig = {
    // self-host: Docker 최소 번들(.next/standalone + server.js)
    output: 'standalone',

    // ISR/fetch 캐시를 S3로 외부화(디스크풀 방지). production + 버킷 설정 시에만 등록.
    // dev/E2E(버킷 없음)는 기본 파일시스템 캐시로 동작.
    cacheHandler:
        process.env.NODE_ENV === 'production' && process.env.ISR_CACHE_BUCKET
            ? require.resolve('./cache-handler/index.mjs')
            : undefined,
    // 인스턴스 로컬 L1을 끄고 모든 read/write를 핸들러로 보낸다는 의도.
    // ⚠️ 실제로는 이 값을 Next 기본 `FileSystemCache`만 소비한다(next/dist/server/lib/
    // incremental-cache/file-system-cache.js). 위 `cacheHandler`가 등록된 프로덕션에서는
    // 애초에 끌 L1이 없어 **no-op**이고, 핸들러가 없는 dev/E2E에서만 실효가 있다.
    // 남겨두는 이유는 그 dev/E2E 경로와, 핸들러가 비활성일 때의 명시적 의도 표명이다.
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

    /*
     * 오리진에서 gzip을 건다.
     *
     * 원래는 "CloudFlare가 엣지에서 brotli로 압축하니 이중압축을 피하자"는 이유로
     * 껐는데, 프로덕션 실측 결과 **그 전제가 성립하지 않았다**:
     *
     *   - `/_next/static/**`(CSS·JS) → `content-encoding: br` ✅
     *   - HTML 문서(`/`, `/AAPL`, `/market` …) → `content-encoding` 헤더 자체가 없음 ❌
     *     (`Accept-Encoding: br, gzip`으로 요청해도 바이트 수가 동일하고,
     *      `cf-cache-status: MISS`로 강제해도 마찬가지)
     *
     * 그래서 홈이 998KB, `/AAPL`이 728KB짜리 **비압축** HTML로 나갔고 Lighthouse가
     * 이를 그대로 집어냈다(`document-latency-insight`: 669KiB 절감 가능,
     * 데스크톱 LCP 4.2s / FCP 3.0s / 성능 63점).
     *
     * **대가가 있다 — 정적 자산은 brotli를 잃는다.** Next의 압축 미들웨어는
     * gzip/deflate만 협상하고 라우트별로 끌 수 없다(all-or-nothing). 그래서 켜는
     * 순간 `/_next/static/**`도 오리진에서 gzip이 붙고, CloudFlare는 이미
     * `content-encoding`이 있는 응답을 재압축하지 않으므로 지금 받고 있는 `br`이
     * gzip으로 내려앉는다. 홈 기준 실측 손익:
     *
     *   HTML   비압축 1,021KB → gzip 201KB   =  **-820KB** (매 요청)
     *   정적   brotli 439KB  → gzip 496KB   =  **+57KB**  (1년 immutable 캐시라 첫 방문만)
     *   ────────────────────────────────────────────────
     *   순이득 763KB
     *
     * **더 나은 해법이 있다면 그쪽이 맞다**: CloudFlare에서 `text/html`에 Compression
     * Rule을 걸면 HTML은 brotli(173KB, gzip보다 28KB 더 작음)로 나가고 정적 자산의
     * brotli도 지켜지며 오리진 CPU는 0이다. 애초에 왜 엣지가 HTML만 압축하지 않는지는
     * 근본 원인이 밝혀지지 않았다 — 그게 규명되면 이 플래그는 되돌리는 것이 낫다.
     *
     * CPU 비용은 과소평가하지 말 것: CF HTML 히트율은 실측 36.7%
     * (docs/architecture/CDN_CACHING.md)라 나머지는 오리진까지 오고, RSC 페이로드도
     * 압축 대상이다. t4g는 버스터블이라 배포 후 `CPUUtilization`과
     * `CPUCreditBalance`를 한 트래픽 주기 동안 지켜본 뒤 전체 롤아웃할 것.
     *
     * SSE는 영향 없다 — `/api/analysis/stream`과 `/api/sse-probe`가 보내는
     * `Cache-Control: no-transform`에서 압축 미들웨어가 빠진다(실측 확인).
     */
    compress: true,

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
    //
    // 참고: ISR cache-handler(cache-handler/**/*.mjs)는 여기 없다 — 의도적이다.
    // 핸들러는 Dockerfile의 명시적 COPY + require.resolve 게이트로 결정적으로 번들된다
    // (tracing 휴리스틱보다 강함). 따라서 outputFileTracingIncludes에 없어도 누락이 아니다.
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
            source: '/sitemap-removal-:kind.xml',
            destination: '/api/sitemap/removal/:kind',
        },
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
                    // X-Frame-Options의 현대적 대체(레거시 브라우저용으로 둘 다 보낸다).
                    // 우리 페이지를 iframe에 넣는 경로는 없고, 클릭재킹으로 로그인/설정
                    // 같은 인증 화면을 감싸는 공격을 CSP 레벨에서 차단한다.
                    key: 'Content-Security-Policy',
                    value: "frame-ancestors 'none'",
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
