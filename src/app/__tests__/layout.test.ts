// layout.tsx는 컴포넌트 트리 전체를 끌고 오므로, `metadata`만 검증하기 위해
// 폰트 로더와 하위 위젯/기능 모듈을 전부 stub으로 대체한다.
vi.mock('next/font/google', () => ({
    Geist: () => ({ variable: '--font-geist-sans' }),
    Geist_Mono: () => ({ variable: '--font-geist-mono' }),
}));
vi.mock('next/font/local', () => ({
    default: () => ({ variable: '--font-pretendard' }),
}));
vi.mock('next/script', () => ({ default: () => null }));
vi.mock('@/app/_components/AuthSessionHeaderClient', () => ({
    AuthSessionHeaderClient: () => null,
}));
vi.mock('@/widgets/layout/Footer', () => ({ Footer: () => null }));
vi.mock('@/widgets/layout/SiteJsonLd', () => ({ SiteJsonLd: () => null }));
vi.mock('@/features/pwa-install', () => ({ PwaBanner: () => null }));
vi.mock('@/widgets/notice-popup', () => ({ NoticePopupLoader: () => null }));
vi.mock('@/app/providers', () => ({
    ReactQueryProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/shared/lib/og', () => ({
    OG_IMAGE_WIDTH: 1200,
    OG_IMAGE_HEIGHT: 630,
}));

import { metadata } from '@/app/layout';
import { ROOT_FULL_TITLE, ROOT_TITLE, SITE_NAME } from '@/shared/lib/seo';

/**
 * 리뷰 회귀 가드(round 2 fix 1): ROOT_TITLE에서 브랜드 접미사를 뺀 라운드에서
 * openGraph.title/twitter.title도 같이 브랜드를 잃었다 — title.default는
 * SERP 폭 예산 때문에 브랜드를 빼야 맞지만, 소셜 언퍼널(Kakao/Slack/Twitter/
 * Facebook)은 폭 제약이 없어 브랜드를 유지해야 한다. 이 두 필드만 별도로
 * ROOT_FULL_TITLE(브랜드 포함)을 쓰는지 고정한다.
 */
describe('RootLayout metadata', () => {
    it('title.default는 브랜드 접미사 없는 ROOT_TITLE 그대로다', () => {
        expect(metadata.title).toEqual(
            expect.objectContaining({ default: ROOT_TITLE })
        );
    });

    it('openGraph.title은 브랜드가 붙은 ROOT_FULL_TITLE을 쓴다', () => {
        expect(metadata.openGraph?.title).toBe(ROOT_FULL_TITLE);
        expect(ROOT_FULL_TITLE).toContain(SITE_NAME);
    });

    it('twitter.title은 브랜드가 붙은 ROOT_FULL_TITLE을 쓴다', () => {
        expect(metadata.twitter?.title).toBe(ROOT_FULL_TITLE);
    });
});
