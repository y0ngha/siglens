import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/shared/lib/seo';

// 검색엔진이 아닌 기생 SEO 크롤러(백링크/순위 분석 SaaS). 포털 랭킹에 기여하지 않으면서
// 트래픽만 유발하므로 전면 Disallow한다 — Googlebot/Yeti/Bingbot/Daumoa 등 실제
// 검색엔진은 절대 포함하지 않는다. 이 봇들은 robots.txt를 준수한다.
const PARASITE_BOT_USER_AGENTS = [
    'AhrefsBot',
    'SemrushBot',
    'MJ12bot',
    'DotBot',
    'BLEXBot',
    'DataForSeoBot',
];

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                // API 라우트는 disallow로 유지 — 응답이 JSON/이미지 등 SEO 가치
                // 없는 자원이라 crawl budget 절약 목적.
                //
                // 인증 페이지(/login, /signup, /forgot-password, /reset-password)
                // 와 /account는 페이지 metadata에 `robots: { index: false }`로
                // noindex가 박혀 있다. 이전엔 robots.txt에서도 Disallow했었지만,
                // 그 조합은 Googlebot이 페이지를 crawl 못해 noindex 태그를 보지
                // 못하는 충돌을 만든다 — 외부 백링크가 생기면 "Indexed though
                // blocked by robots.txt" 상태로 SERP에 빈 카드로 노출될 위험.
                // noindex가 더 강한 신호이므로 그쪽만 유지하고 Disallow는 제거.
                disallow: ['/api/'],
            },
            {
                userAgent: PARASITE_BOT_USER_AGENTS,
                disallow: '/',
            },
        ],
        sitemap: `${SITE_URL}/sitemap.xml`,
    };
}
