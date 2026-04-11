import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    // React Compiler (Next.js 16 stable)
    reactCompiler: true,

    // 'use cache' 지시어 활성화 (Next.js 16)
    cacheComponents: true,

    // Turbopack (Next.js 16 기본값이나 명시)
    turbopack: {
        root: import.meta.dirname,
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
