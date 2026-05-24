import type { MetadataRoute } from 'next';
import { SITE_NAME } from '@/shared/lib/seo';

// Shorter than SITE_DESCRIPTION because Chrome's install prompt truncates
// around ~135 characters; long Korean copy gets cut mid-sentence.
// PR #415 정책: Skills 개수가 변하면 stale되는 동적 숫자(보조지표 N종)는
// 질적 표현으로 대체. SITE_DESCRIPTION과 같은 접근.
const MANIFEST_DESCRIPTION =
    '미국 주식 AI 기술적 분석 — 차트·펀더멘털·뉴스를 묶어 다양한 보조지표 기반 종합 결론과 2년 백테스팅을 제공합니다.';

export default function manifest(): MetadataRoute.Manifest {
    return {
        id: '/',
        name: `${SITE_NAME} — 미국 주식 AI 기술적 분석`,
        short_name: SITE_NAME,
        description: MANIFEST_DESCRIPTION,
        lang: 'ko-KR',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        display_override: ['standalone'],
        orientation: 'portrait',
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
                icons: [
                    { src: '/icon96.png', sizes: '96x96', type: 'image/png' },
                ],
            },
            {
                name: '종목 검색',
                url: '/?focus=search',
                icons: [
                    { src: '/icon96.png', sizes: '96x96', type: 'image/png' },
                ],
            },
        ],
    };
}
