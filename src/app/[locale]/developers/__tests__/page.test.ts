/**
 * 뷰는 목으로 바꾼다 — 화면은 `views/developers` 스위트가 검사하고, 여기서는 라우트가 넘기는 props(도구 레퍼런스·
 * 갱신일)와 메타데이터·JSON-LD만 본다. `buildWebPageJsonLd`·`buildBreadcrumbJsonLd`는 실제 구현이다.
 */
vi.mock('@/views/developers/DevelopersPage', () => ({
    DevelopersPage: () => null,
}));
vi.mock('@/app/api/v1/publicApiTools', () => ({
    publicApiToolSpecs: () => [
        {
            name: 'get_quote',
            description: 'Latest price.',
            costClass: 'free',
            inputSchema: {
                type: 'object',
                properties: {
                    symbols: { type: 'array', items: { type: 'string' } },
                },
                required: ['symbols'],
                additionalProperties: false,
            },
        },
        {
            name: 'run_fresh_analysis',
            description: 'Fresh analysis.',
            costClass: 'expensive',
            inputSchema: {
                type: 'object',
                properties: { symbol: { type: 'string' } },
                required: ['symbol'],
                additionalProperties: false,
            },
        },
    ],
}));
/**
 * 갱신일을 실제 상수와 **다른 날**로 바꾼다 — 라우트가 엉뚱한 상수(예: 방법론 갱신일)를 읽어도 통과하는
 * 배선 오류를 잡으려는 것이다. 경로·그 밖의 상수는 실제 값이다.
 */
vi.mock('@/shared/config/publicApi', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/config/publicApi')>()),
    DEVELOPERS_UPDATED_AT: new Date('2026-11-02T00:00:00+09:00'),
}));
vi.mock('@/shared/lib/og', () => ({
    OG_IMAGE_WIDTH: 1200,
    OG_IMAGE_HEIGHT: 630,
}));

import {
    generateMetadata,
    default as DevelopersRoute,
    revalidate,
} from '@/app/[locale]/developers/page';
import { isValidElement, type ReactNode } from 'react';
import { collectJsonLdData } from '@/__tests__/utils/collectJsonLdData';
import { DEVELOPERS_PATH } from '@/shared/config/publicApi';
import { ORGANIZATION_JSON_LD_ID, SITE_URL } from '@/shared/lib/seo';
import ko from '../../../../../messages/ko.json';

interface ViewProps {
    readonly tools: { name: string; byok: boolean; curl: string }[];
    readonly updatedAt: string;
    readonly title: string;
    readonly baseUrl: string;
}

/** 뷰가 목이라 렌더할 수 없다 — element tree에서 `DevelopersPage`에 넘긴 props를 찾는다. */
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
    if (props.tools !== undefined) return props as ViewProps;
    return findViewProps(props.children);
}

const renderRoute = (locale = 'ko') =>
    DevelopersRoute({ params: Promise.resolve({ locale }) });

const metadataFor = (locale = 'ko') =>
    generateMetadata({ params: Promise.resolve({ locale }) });

describe('Developers page', () => {
    it('revalidate는 하루(86400초) 리터럴이다', () => {
        expect(revalidate).toBe(86400);
    });

    it('메타 타이틀은 레이아웃 템플릿을 타지 않는다 — 이미 시그렌즈로 시작한다', async () => {
        const metadata = await metadataFor();
        expect(metadata.title).toEqual({
            absolute: ko.shared.seo.developers.metaTitle,
        });
        expect(ko.shared.seo.developers.metaTitle).toMatch(/^시그렌즈/);
    });

    it('설명은 카탈로그의 shared.seo.developers.description이다', async () => {
        const metadata = await metadataFor();
        expect(metadata.description).toBe(ko.shared.seo.developers.description);
    });

    it('ko는 색인을 허용하고 비-ko 로케일은 색인하지 않는다', async () => {
        expect((await metadataFor('ko')).robots).toEqual(
            expect.objectContaining({ index: true })
        );
        expect((await metadataFor('en')).robots).toEqual(
            expect.objectContaining({ index: false })
        );
    });

    it('자기 자신을 canonical로 가리키고 en은 자기 로케일 URL을 가리킨다', async () => {
        expect((await metadataFor()).alternates?.canonical).toBe(
            `${SITE_URL}${DEVELOPERS_PATH}`
        );
        expect((await metadataFor('en')).alternates?.canonical).toBe(
            `${SITE_URL}/en${DEVELOPERS_PATH}`
        );
    });

    it('소셜 카드(openGraph·twitter)를 제목·설명·이미지까지 명시한다', async () => {
        const metadata = await metadataFor();
        expect(metadata.openGraph).toEqual(
            expect.objectContaining({
                type: 'website',
                title: ko.shared.seo.developers.metaTitle,
                description: ko.shared.seo.developers.description,
                url: `${SITE_URL}${DEVELOPERS_PATH}`,
                images: [expect.objectContaining({ url: '/og-image.png' })],
            })
        );
        expect(metadata.twitter).toEqual(
            expect.objectContaining({
                card: 'summary',
                title: ko.shared.seo.developers.metaTitle,
            })
        );
    });

    it('WebPage JSON-LD가 dateModified(본문 갱신 상수)와 publisher @id를 싣는다', async () => {
        const nodes = collectJsonLdData(await renderRoute());
        const webPage = nodes.find(n => n['@type'] === 'WebPage');
        expect(webPage?.url).toBe(`${SITE_URL}${DEVELOPERS_PATH}`);
        expect(webPage?.dateModified).toBe('2026-11-01T15:00:00.000Z');
        expect(webPage?.publisher).toEqual({ '@id': ORGANIZATION_JSON_LD_ID });
    });

    it('BreadcrumbList를 내보내고 FAQPage는 내보내지 않는다', async () => {
        const nodes = collectJsonLdData(await renderRoute());
        const crumb = nodes.find(n => n['@type'] === 'BreadcrumbList');
        const items = crumb?.itemListElement as { name: string }[];
        expect(items.at(-1)?.name).toBe(ko.shared.seo.developers.title);
        expect(nodes.some(n => n['@type'] === 'FAQPage')).toBe(false);
    });

    it('노출 도구 스펙에서 만든 레퍼런스(순서 그대로)와 갱신일을 뷰에 넘긴다', async () => {
        const view = findViewProps(await renderRoute());
        expect(view?.tools.map(tool => tool.name)).toEqual([
            'get_quote',
            'run_fresh_analysis',
        ]);
        expect(view?.tools.map(tool => tool.byok)).toEqual([false, true]);
        expect(view?.tools[0]?.curl).toContain(
            `${SITE_URL}/api/v1/tools/get_quote`
        );
        expect(view?.baseUrl).toBe(SITE_URL);
        expect(view?.title).toBe(ko.shared.seo.developers.title);
        expect(view?.updatedAt).toBe('2026년 11월 2일');
    });
});
