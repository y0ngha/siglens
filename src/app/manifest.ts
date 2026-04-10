import type { MetadataRoute } from 'next';
import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/seo';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: `${SITE_NAME} — 미국 주식 AI 기술적 분석`,
        short_name: SITE_NAME,
        description: SITE_DESCRIPTION,
        start_url: '/',
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        icons: [
            { src: '/icon.png', sizes: '192x192', type: 'image/png' },
            { src: '/icon.png', sizes: '512x512', type: 'image/png' },
        ],
    };
}
