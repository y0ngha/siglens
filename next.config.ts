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

    // skills/ 디렉토리는 fs.readdir로 동적 접근하므로 Vercel이 자동 추적하지 못한다.
    // 명시적으로 포함시켜 Server Actions에서 파일을 읽을 수 있도록 한다.
    outputFileTracingIncludes: {
        '/**': ['./skills/**/*'],
    },

    // 'use cache' 지시어 활성화 (Next.js 16)
    cacheComponents: true,

    // 옵션 분석용 cacheLife profile — 미국 동부 시간대(ET) 기준으로
    // 옵션 시장이 열려있을 때(빠른 변동), 마감 후(거의 정지),
    // 주말/공휴일(완전 정지) 캐시 동작이 달라야 한다.
    cacheLife: (() => {
        const SECONDS_PER_MINUTE = 60;
        const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE;
        const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR;
        return {
            'options-market-open': {
                stale: 1 * SECONDS_PER_MINUTE,
                revalidate: 5 * SECONDS_PER_MINUTE,
                expire: 30 * SECONDS_PER_MINUTE,
            },
            'options-market-closed': {
                stale: 5 * SECONDS_PER_MINUTE,
                revalidate: 30 * SECONDS_PER_MINUTE,
                expire: 2 * SECONDS_PER_HOUR,
            },
            'options-weekend': {
                stale: 1 * SECONDS_PER_HOUR,
                revalidate: 6 * SECONDS_PER_HOUR,
                expire: 1 * SECONDS_PER_DAY,
            },
        };
    })(),

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
