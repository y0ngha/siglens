vi.mock('@/widgets/legal/PolicyMarkdownBody', () => ({
    PolicyMarkdownBody: () => null,
}));
vi.mock('@/widgets/legal/LegalPageShell', () => ({
    LegalPageShell: () => null,
}));
vi.mock('@/shared/ui/JsonLd', () => ({ JsonLd: () => null }));
vi.mock('@/shared/lib/legal', () => ({
    formatKoreanDate: vi.fn().mockReturnValue('2025년 1월 1일'),
    INVESTMENT_DISCLAIMER_KEY: 'investmentDisclaimer',
    termsDescription: () => 'terms desc',
    termsFullTitle: () => 'Terms Full Title',
    TERMS_PATH: '/terms',
    termsTitle: () => '이용약관',
}));
vi.mock('@/shared/lib/legal-toc', () => ({
    extractToc: vi.fn().mockReturnValue([]),
}));
vi.mock('@/shared/lib/og', () => ({
    OG_IMAGE_WIDTH: 1200,
    OG_IMAGE_HEIGHT: 630,
}));
/**
 * **부분 목이다.** 통째로 갈아끼우면 이 모듈에 export가 하나 생길 때마다
 * `No "x" export is defined on the mock`으로 깨지고, 더 나쁘게는 URL을 만드는
 * 로직이 스텁으로 대체돼 테스트가 아무것도 검증하지 못한다.
 */
vi.mock('@/shared/lib/seo', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/lib/seo')>()),
    buildWebPageJsonLd: () => ({}),
    buildBreadcrumbJsonLd: vi.fn().mockReturnValue({}),
    SITE_NAME: 'Siglens',
    SITE_URL: 'https://siglens.io',
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn().mockReturnValue({ db: {} }),
}));
/**
 * 활성 약관이 **있는** 상태를 목한다. 없으면 `generateMetadata`가 noindex +
 * canonical null을 내는 것이 맞는 동작이라(soft-404 방지), 아래 "index + canonical"
 * 단언은 활성 행이 있는 전제에서만 의미가 있다. 행이 없는 분기는
 * `__tests__/legalSoft404.test.tsx`가 본다.
 */
vi.mock('@/entities/terms/api', () => ({
    getActiveTerms: vi.fn().mockResolvedValue({
        id: 'row-1',
        kind: 'tos',
        version: 1,
        effectiveDate: new Date('2025-01-01T00:00:00.000Z'),
        body: '# 본문',
        bodyLocale: 'ko',
        isTranslationFallback: false,
    }),
}));
vi.mock('next/navigation', () => ({
    notFound: vi.fn(),
}));

import { Suspense, type ReactElement, type ReactNode } from 'react';
import TermsPage, { generateMetadata } from '@/app/[locale]/terms/page';

/** 페이지가 돌려준 트리에서 Suspense 경계를 찾는다(자식 컴포넌트 안쪽은 보지 않는다). */
function hasSuspense(node: ReactNode): boolean {
    if (Array.isArray(node)) return node.some(hasSuspense);
    if (node === null || typeof node !== 'object' || !('type' in node))
        return false;
    const element = node as ReactElement<{ children?: ReactNode }>;
    return element.type === Suspense || hasSuspense(element.props.children);
}

const metadataFor = (locale = 'ko') =>
    generateMetadata({ params: Promise.resolve({ locale }) });

describe('Terms page', () => {
    it('exports metadata with terms title', async () => {
        const metadata = await metadataFor();
        expect(metadata.title).toBe('이용약관');
    });

    it('allows indexing', async () => {
        const metadata = await metadataFor();
        expect(metadata.robots).toEqual(
            expect.objectContaining({ index: true })
        );
    });

    it('includes canonical URL', async () => {
        const metadata = await metadataFor();
        expect(metadata.alternates?.canonical).toBe('https://siglens.io/terms');
    });

    it('sets openGraph type to article', async () => {
        const metadata = await metadataFor();
        expect(metadata.openGraph).toEqual(
            expect.objectContaining({ type: 'article' })
        );
    });

    it('sets twitter card to summary', async () => {
        const metadata = await metadataFor();
        expect(metadata.twitter).toEqual(
            expect.objectContaining({ card: 'summary' })
        );
    });
    /**
     * ISR 응답은 통째로 버퍼링돼 스트리밍 이득이 없는데, React는 500B를 넘는 경계를
     * fallback + 숨김 청크로 내보낸다. 빈 fallback 자리에 푸터가 먼저 그려졌다가
     * 본문이 풀리며 밀려 모바일 CLS가 0.74였다(2026-10-04 운영 Lighthouse).
     */
    it('본문을 Suspense로 감싸지 않는다', async () => {
        const tree = await TermsPage({
            params: Promise.resolve({ locale: 'ko' }),
        });
        expect(hasSuspense(tree)).toBe(false);
    });
});
