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

import { generateMetadata, generateStaticParams } from '@/app/[locale]/layout';
import { ROOT_FULL_TITLE, ROOT_TITLE, SITE_NAME } from '@/shared/lib/seo';
import { LOCALES, LOCALE_OG } from '@/shared/i18n/locales';

async function metadataFor(locale: string) {
    return generateMetadata({ params: Promise.resolve({ locale }) });
}

/**
 * 리뷰 회귀 가드(round 2 fix 1): ROOT_TITLE에서 브랜드 접미사를 뺀 라운드에서
 * openGraph.title/twitter.title도 같이 브랜드를 잃었다 — title.default는
 * SERP 폭 예산 때문에 브랜드를 빼야 맞지만, 소셜 언퍼널(Kakao/Slack/Twitter/
 * Facebook)은 폭 제약이 없어 브랜드를 유지해야 한다. 이 두 필드만 별도로
 * ROOT_FULL_TITLE(브랜드 포함)을 쓰는지 고정한다.
 */
describe('RootLayout metadata', () => {
    it('title.default는 브랜드 접미사 없는 ROOT_TITLE 그대로다', async () => {
        const metadata = await metadataFor('ko');
        expect(metadata.title).toEqual(
            expect.objectContaining({ default: ROOT_TITLE })
        );
    });

    it('openGraph.title은 브랜드가 붙은 ROOT_FULL_TITLE을 쓴다', async () => {
        const metadata = await metadataFor('ko');
        expect(metadata.openGraph?.title).toBe(ROOT_FULL_TITLE);
        expect(ROOT_FULL_TITLE).toContain(SITE_NAME);
    });

    it('twitter.title은 브랜드가 붙은 ROOT_FULL_TITLE을 쓴다', async () => {
        const metadata = await metadataFor('ko');
        expect(metadata.twitter?.title).toBe(ROOT_FULL_TITLE);
    });
});

describe('RootLayout 로케일', () => {
    /**
     * `generateStaticParams`가 **빈 배열을 반환하면** `[locale]`이 dynamic
     * 세그먼트로 남아 전 라우트의 ISR이 꺼진다. 최소 하나는 반드시 나와야 한다.
     *
     * 반대로 4개를 전부 프리렌더하면 빌드 중 FMP 호출이 4배가 되어 429로
     * 빌드가 실패한다(실측). 기본값이 ko 하나인 것은 그 균형점이다.
     */
    it('generateStaticParams는 기본적으로 기본 로케일만 프리렌더한다', () => {
        expect(generateStaticParams()).toEqual([{ locale: 'ko' }]);
    });

    it.each(LOCALES)(
        '%s: og:locale과 alternateLocale이 상호 배타적이다',
        async locale => {
            const metadata = await metadataFor(locale);
            expect(metadata.openGraph?.locale).toBe(LOCALE_OG[locale]);
            expect(metadata.openGraph?.alternateLocale).toEqual(
                LOCALES.filter(l => l !== locale).map(l => LOCALE_OG[l])
            );
        }
    );

    /**
     * 레이아웃은 `alternates`를 선언하지 **않는다**.
     *
     * Next.js는 세그먼트 간 메타데이터를 최상위 키 단위로 교체한다 — 페이지가
     * `alternates: { canonical }`을 선언하는 순간 레이아웃의 `languages`가 통째로
     * 사라진다. 실측에서 전 페이지 hreflang이 0개였고 빌드·타입체크는 통과했다.
     * 그래서 hreflang은 페이지마다 `localeAlternatesFrom`으로 선언한다. 여기에
     * `alternates`를 다시 넣으면 "선언했으니 나가겠지"라는 착각이 재발한다.
     */
    it('레이아웃은 alternates를 선언하지 않는다 — 페이지가 교체해 버린다', async () => {
        const metadata = await metadataFor('ko');
        expect(metadata.alternates).toBeUndefined();
    });
});
