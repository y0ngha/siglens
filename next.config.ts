import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    // React Compiler (Next.js 16 stable)
    reactCompiler: true,

    // skills/ 디렉토리는 fs.readdir로 동적 접근하므로 Vercel이 자동 추적하지 못한다.
    // 명시적으로 포함시켜 Server Actions에서 파일을 읽을 수 있도록 한다.
    outputFileTracingIncludes: {
        '/**': ['./skills/**/*'],
    },

    // 'use cache' 지시어 활성화 (Next.js 16)
    cacheComponents: true,

    // Turbopack (Next.js 16 기본값이나 명시)
    turbopack: {
        root: import.meta.dirname,
    },

    // TODO: 임시 조치. submitAnalysisAction이 bars+indicators 전체를 payload로 보내 1MB 초과.
    // 근본 해결은 Server Action 내부에서 서버가 직접 fetchBarsWithIndicators로 재구성하도록 리팩토링.
    experimental: {
        serverActions: {
            bodySizeLimit: '5mb',
        },
    },

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
