/**
 * 뷰는 목으로 바꾼다 — 화면은 `views/about` 스위트가 검사하고, 여기서는
 * 라우트가 넘기는 props(카운트·FAQ·갱신일)와 메타데이터·JSON-LD만 본다.
 * `getAboutFaq`는 실제 구현을 써서 FAQPage 마크업이 실제 카탈로그 문답과
 * 같은지 확인한다.
 */
vi.mock('@/views/about', async importOriginal => ({
    ...(await importOriginal<typeof import('@/views/about')>()),
    AboutPage: () => null,
}));
vi.mock('@/shared/lib/og', () => ({
    OG_IMAGE_WIDTH: 1200,
    OG_IMAGE_HEIGHT: 630,
}));
vi.mock('@/entities/skill', () => ({
    countSkillFiles: vi.fn().mockResolvedValue({
        indicators: 13,
        candlesticks: 30,
        patterns: 5,
        strategies: 4,
        supportResistance: 3,
        fundamental: 2,
        news: 1,
    }),
}));
/**
 * 부분 목이다(terms 스위트와 같은 이유) — `SITE_OPERATOR`/`ABOUT_PATH`/
 * `ABOUT_UPDATED_AT`는 실제 값을 유지해 JSON-LD `@id`/`sameAs`가 실제 배선과
 * 일치하는지 검증하고, title/description/formatKoreanDate만 결정적 스텁으로
 * 바꾼다.
 */
vi.mock('@/shared/lib/legal', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/lib/legal')>()),
    aboutTitle: () => 'Siglens 소개',
    aboutFullTitle: () => 'Siglens 소개 Full Title',
    aboutDescription: () => 'about desc',
    formatKoreanDate: vi.fn().mockReturnValue('2026년 9월 11일'),
}));
/**
 * **부분 목이다.** 통째로 갈아끼우면 이 모듈에 export가 하나 생길 때마다
 * `No "x" export is defined on the mock`으로 깨지고, 더 나쁘게는 URL을 만드는
 * 로직이 스텁으로 대체돼 테스트가 아무것도 검증하지 못한다.
 */
vi.mock('@/shared/lib/seo', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/lib/seo')>()),
    buildWebPageJsonLd: () => ({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
    }),
    buildBreadcrumbJsonLd: vi.fn().mockReturnValue({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
    }),
    SITE_NAME: 'Siglens',
    SITE_URL: 'https://siglens.io',
}));

import {
    generateMetadata,
    default as AboutRoute,
} from '@/app/[locale]/about/page';
import { isValidElement, type ReactNode } from 'react';
import { collectJsonLdData } from '@/__tests__/utils/collectJsonLdData';
import {
    ABOUT_UPDATED_AT,
    OPERATOR_PERSON_JSON_LD_ID,
} from '@/shared/lib/legal';
import { ORGANIZATION_JSON_LD_ID } from '@/shared/lib/seo';

interface ViewProps {
    readonly counts: { indicators: number };
    readonly faq: readonly { question: string; answer: string }[];
    readonly updatedAt: string;
    readonly title: string;
}

/** 뷰가 목이라 렌더할 수 없다 — element tree에서 `AboutPage`에 넘긴 props를 찾는다. */
function findViewProps(node: ReactNode): ViewProps | undefined {
    if (Array.isArray(node)) {
        for (const child of node) {
            const found = findViewProps(child);
            if (found !== undefined) return found;
        }
        return undefined;
    }
    if (!isValidElement(node)) return undefined;
    const props = node.props as Partial<ViewProps> & { children?: ReactNode };
    if (props.faq !== undefined) return props as ViewProps;
    return findViewProps(props.children);
}

const renderRoute = (locale = 'ko') =>
    AboutRoute({ params: Promise.resolve({ locale }) });

const metadataFor = (locale = 'ko') =>
    generateMetadata({ params: Promise.resolve({ locale }) });

describe('About page', () => {
    it('메타 타이틀은 레이아웃 템플릿을 타지 않는다 — 이미 Siglens로 시작한다', async () => {
        const metadata = await metadataFor();
        expect(metadata.title).toEqual({ absolute: 'Siglens 소개 Full Title' });
    });

    it('allows indexing', async () => {
        const metadata = await metadataFor();
        expect(metadata.robots).toEqual(
            expect.objectContaining({ index: true })
        );
    });

    it('includes canonical URL', async () => {
        const metadata = await metadataFor();
        expect(metadata.alternates?.canonical).toBe('https://siglens.io/about');
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

    it('renders AboutPage and Person JSON-LD nodes for ko, cross-linked to the home Organization', async () => {
        const nodes = collectJsonLdData(await renderRoute());

        const aboutPage = nodes.find(n => n['@type'] === 'AboutPage');
        expect(aboutPage).toBeDefined();
        expect(aboutPage?.mainEntity).toEqual({
            '@id': ORGANIZATION_JSON_LD_ID,
        });
        expect(aboutPage?.dateModified).toBe(ABOUT_UPDATED_AT.toISOString());

        const person = nodes.find(n => n['@type'] === 'Person');
        expect(person).toBeDefined();
        expect(person?.name).toBe('y0ngha');
        expect(person?.['@id']).toBe(OPERATOR_PERSON_JSON_LD_ID);
        expect(person?.email).toBe('mailto:dev.y0ngha@gmail.com');
        expect(person?.sameAs).toEqual(['https://github.com/y0ngha']);
        expect(person?.affiliation).toEqual({
            '@id': ORGANIZATION_JSON_LD_ID,
        });
    });

    it('홈과 같은 소스(countSkillFiles)의 카운트를 뷰에 넘긴다', async () => {
        const view = findViewProps(await renderRoute());
        expect(view?.counts.indicators).toBe(13);
        expect(view?.title).toBe('Siglens 소개');
        expect(view?.updatedAt).toBe('2026년 9월 11일');
    });

    it('countSkillFiles가 실패해도 0 카운트로 렌더한다', async () => {
        const { countSkillFiles } = await import('@/entities/skill');
        vi.mocked(countSkillFiles).mockRejectedValueOnce(new Error('boom'));
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        const view = findViewProps(await renderRoute());
        expect(view?.counts.indicators).toBe(0);
        expect(errorSpy).toHaveBeenCalledWith(
            '[AboutPage] countSkillFiles failed:',
            expect.any(Error)
        );
        errorSpy.mockRestore();
    });

    it('FAQPage JSON-LD가 화면에 넘기는 FAQ와 같은 배열이다', async () => {
        const tree = await renderRoute();
        const view = findViewProps(tree);
        const faqBlocks = collectJsonLdData(tree).filter(
            n => n['@type'] === 'FAQPage'
        );
        expect(faqBlocks).toHaveLength(1);
        const entities = faqBlocks[0]!.mainEntity as {
            name: string;
            acceptedAnswer: { text: string };
        }[];
        expect(view!.faq.length).toBeGreaterThan(0);
        expect(entities.map(e => [e.name, e.acceptedAnswer.text])).toEqual(
            view!.faq.map(f => [f.question, f.answer])
        );
    });
});
