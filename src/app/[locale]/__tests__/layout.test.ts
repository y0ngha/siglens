// layout.tsx는 컴포넌트 트리 전체를 끌고 오므로, `metadata`만 검증하기 위해
// 폰트 로더와 하위 위젯/기능 모듈을 전부 stub으로 대체한다.
vi.mock('next/font/google', () => ({
    Geist_Mono: () => ({ variable: '--font-geist-mono' }),
}));
vi.mock('next/font/local', () => ({
    default: () => ({ variable: '--font-pretendard' }),
}));
vi.mock('next/script', () => ({
    default: function Script() {
        return null;
    },
}));
vi.mock('@/app/_components/AuthSessionHeaderClient', () => ({
    AuthSessionHeaderClient: () => null,
}));
vi.mock('@/widgets/layout/Footer', () => ({ Footer: () => null }));
vi.mock('@/widgets/layout/SiteJsonLd', () => ({ SiteJsonLd: () => null }));
vi.mock('@/features/pwa-install/ui/PwaBanner', () => ({
    PwaBanner: () => null,
}));
vi.mock('@/widgets/notice-popup/ui/NoticePopupLoader', () => ({
    NoticePopupLoader: () => null,
}));
vi.mock('@/app/providers', () => ({
    ReactQueryProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/shared/lib/og', () => ({
    OG_IMAGE_WIDTH: 1200,
    OG_IMAGE_HEIGHT: 630,
}));

import RootLayout, {
    generateMetadata,
    generateStaticParams,
} from '@/app/[locale]/layout';
import Script from 'next/script';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { THEME_INIT_SCRIPT } from '@/shared/lib/theme';
import { STATIC_INDEXABLE_LOCALES } from '@/shared/i18n/indexableLocales';
import { brandIntroName, SITE_NAME, SITE_NAME_KO } from '@/shared/lib/seo';
import koMessages from '@/../messages/ko.json';

// 홈 제목은 `shared.seo.root` 카탈로그가 소유한다. 브랜드 접미사는 레이아웃이
// 붙이므로 여기서 같은 방식으로 조립해 대조한다.
const ROOT_TITLE = koMessages.shared.seo.root.title.replace(
    '{v0}',
    brandIntroName('ko')
);
import { LOCALES, LOCALE_OG } from '@/shared/i18n/locales';

async function metadataFor(locale: string) {
    return generateMetadata({ params: Promise.resolve({ locale }) });
}

/**
 * 브랜드는 제목 자체에 들어 있다(`시그렌즈(SIGLENS) — …`) — 2026-10-05 감사에서 홈 제목에
 * 브랜드가 없어 "시그렌즈"·"SIGLENS" 검색이 홈으로 귀결되지 않았다. 그래서 og/twitter도
 * 접미사(`| SIGLENS`)를 따로 붙이지 않고 같은 제목을 쓴다(둘 다 한글 표기를 담는다).
 */
describe('RootLayout metadata', () => {
    it('title.default는 브랜드가 들어간 ROOT_TITLE 그대로다(폭 ≤ 55)', async () => {
        const metadata = await metadataFor('ko');
        expect(metadata.title).toEqual(
            expect.objectContaining({ default: ROOT_TITLE })
        );
        expect(ROOT_TITLE).toContain(SITE_NAME_KO);
        expect(ROOT_TITLE).toContain(SITE_NAME);
    });

    it('openGraph.title은 ROOT_TITLE이고 한글 브랜드를 담는다', async () => {
        const metadata = await metadataFor('ko');
        expect(metadata.openGraph?.title).toBe(ROOT_TITLE);
        expect(metadata.openGraph?.title).toContain(SITE_NAME_KO);
    });

    it('twitter.title은 ROOT_TITLE이고 twitter:site가 서비스 계정이다', async () => {
        const metadata = await metadataFor('ko');
        expect(metadata.twitter?.title).toBe(ROOT_TITLE);
        expect(metadata.twitter?.title).toContain(SITE_NAME_KO);
        expect(metadata.twitter).toMatchObject({ site: '@siglens_io' });
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
        /**
         * `alternateLocale`은 **색인 게이트를 통과한 로케일**만 나열한다
         * (`STATIC_INDEXABLE_LOCALES`, 현재 ko 하나). 전 로케일을 무조건
         * 광고하면 hreflang에서 걷어낸 문제 — 준비 안 된 로케일을 외부에
         * 알리는 것 — 를 og 계층에서 반복한다. 예전에는 이 레이아웃이 자체
         * 하드코딩을 갖고 있어 **홈 페이지만** 게이트를 우회했다(실측).
         */
        '%s: alternateLocale은 색인 가능한 로케일만 담는다',
        async locale => {
            const metadata = await metadataFor(locale);
            expect(metadata.openGraph?.locale).toBe(LOCALE_OG[locale]);
            // 색인 가능 로케일이 하나뿐이면 클러스터가 성립하지 않으므로
            // hreflang과 마찬가지로 대체본을 광고하지 않는다.
            expect(metadata.openGraph?.alternateLocale).toEqual(
                STATIC_INDEXABLE_LOCALES.length < 2
                    ? []
                    : STATIC_INDEXABLE_LOCALES.filter(l => l !== locale).map(
                          l => LOCALE_OG[l]
                      )
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

interface ElementProps {
    children?: ReactNode;
    [key: string]: unknown;
}

/** 서버 컴포넌트가 돌려준 엘리먼트 트리를 깊이 우선으로 펼친다(렌더 없이). */
function collectElements(node: ReactNode): ReactElement<ElementProps>[] {
    if (Array.isArray(node)) return node.flatMap(collectElements);
    if (!isValidElement<ElementProps>(node)) return [];
    return [node, ...collectElements(node.props.children)];
}

/**
 * 헤더가 테마 토글을 그리는데 이 호스트에만 페인트 전 부트스트랩이 없어서, 라이트를
 * 고른 사용자도 새로고침마다 다크로 돌아왔다. ai·lp 레이아웃과 같은 방식으로 싣는다.
 */
describe('RootLayout 테마 부트스트랩', () => {
    async function renderTree() {
        return (await RootLayout({
            children: null,
            params: Promise.resolve({ locale: 'ko' }),
        })) as ReactElement<ElementProps>;
    }

    it('THEME_INIT_SCRIPT를 beforeInteractive로 싣는다', async () => {
        const scripts = collectElements(await renderTree()).filter(
            element => element.type === Script
        );
        expect(scripts).toContainEqual(
            expect.objectContaining({
                props: expect.objectContaining({
                    strategy: 'beforeInteractive',
                    dangerouslySetInnerHTML: { __html: THEME_INIT_SCRIPT },
                }),
            })
        );
    });

    it('<html>은 스크립트가 찍는 속성 차이로 인한 하이드레이션 경고만 억제한다', async () => {
        const html = await renderTree();
        expect(html.type).toBe('html');
        expect(html.props.suppressHydrationWarning).toBe(true);
    });
});
