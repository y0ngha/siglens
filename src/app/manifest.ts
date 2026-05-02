import type { MetadataRoute } from 'next';
import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/seo';

export default function manifest(): MetadataRoute.Manifest {
    return {
        id: '/',
        name: `${SITE_NAME} — 미국 주식 AI 기술적 분석`,
        short_name: SITE_NAME,
        description: SITE_DESCRIPTION,
        start_url: '/',
        display: 'standalone',
        display_override: ['standalone'],
        background_color: '#0f172a',
        theme_color: '#0f172a',
        icons: [
            { src: '/icon192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icon512.png', sizes: '512x512', type: 'image/png' },
        ],
        screenshots: [
            {
                src: '/og-image.png',
                sizes: '1200x630',
                type: 'image/png',
                form_factor: 'wide',
            },
        ],
        shortcuts: [
            {
                name: '시장 개요',
                url: '/market',
                icons: [{ src: '/icon96.png', sizes: '96x96' }],
            },
            {
                name: '종목 검색',
                url: '/?focus=search',
                icons: [{ src: '/icon96.png', sizes: '96x96' }],
            },
        ],
    };
}
