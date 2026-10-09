vi.mock('@/entities/guide/api', () => ({ loadGuideCatalog: vi.fn() }));
vi.mock('@/shared/cache/buildDegradedRevalidate', () => ({
    shortenRevalidateForBuildDegrade: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('next/navigation', () => ({
    notFound: vi.fn(() => {
        throw new Error('NEXT_NOT_FOUND');
    }),
}));
vi.mock('@/shared/lib/og', () => ({
    OG_IMAGE_WIDTH: 1200,
    OG_IMAGE_HEIGHT: 630,
}));
/** 뷰는 `views/guide` 스위트가 검사한다. 여기서는 라우트가 넘기는 props만 본다. */
vi.mock('@/views/guide/GuideHubPage', () => ({ GuideHubPage: () => null }));
vi.mock('@/views/guide/GuideCategoryPage', () => ({
    GuideCategoryPage: () => null,
}));
vi.mock('@/views/guide/GuideEntryPage', () => ({
    GuideEntryPage: () => null,
}));
vi.mock('@/views/guide/GuideUnavailablePage', () => ({
    GuideUnavailablePage: () => null,
}));

import { isValidElement, type ReactNode } from 'react';
import { loadGuideCatalog } from '@/entities/guide/api';
import type { GuideCatalog } from '@/entities/guide/types';
import { shortenRevalidateForBuildDegrade } from '@/shared/cache/buildDegradedRevalidate';
import { collectJsonLdData } from '@/__tests__/utils/collectJsonLdData';
import { SITE_URL } from '@/shared/lib/seo';
import { GuideUnavailablePage } from '@/views/guide/GuideUnavailablePage';
import GuideHubRoute, {
    generateMetadata as hubMetadata,
    revalidate as hubRevalidate,
} from '@/app/[locale]/guide/page';
import GuideCategoryRoute, {
    generateMetadata as categoryMetadata,
    generateStaticParams as categoryStaticParams,
    revalidate as categoryRevalidate,
} from '@/app/[locale]/guide/[category]/page';
import GuideEntryRoute, {
    generateMetadata as entryMetadata,
    generateStaticParams as entryStaticParams,
    revalidate as entryRevalidate,
} from '@/app/[locale]/guide/[category]/[slug]/page';
import ko from '../../../../../messages/ko.json';
import { CATALOG, guideEntry, RSI } from './guideFixtures';

const mockLoad = vi.mocked(loadGuideCatalog);

function setCatalog(catalog: GuideCatalog | null) {
    mockLoad.mockResolvedValue(catalog);
}

beforeEach(() => {
    vi.clearAllMocks();
    setCatalog(CATALOG);
});

const hubParams = (locale = 'ko') => ({ params: Promise.resolve({ locale }) });
const categoryParams = (category: string, locale = 'ko') => ({
    params: Promise.resolve({ locale, category }),
});
const entryParams = (category: string, slug: string, locale = 'ko') => ({
    params: Promise.resolve({ locale, category, slug }),
});

/** 트리에서 지정한 컴포넌트에 넘긴 props를 찾는다. */
function findProps(
    node: ReactNode,
    type: unknown
): Record<string, unknown> | undefined {
    if (Array.isArray(node)) {
        for (const child of node) {
            const found = findProps(child, type);
            if (found !== undefined) return found;
        }
        return undefined;
    }
    if (!isValidElement(node)) return undefined;
    if (node.type === type) return node.props as Record<string, unknown>;
    return findProps((node.props as { children?: ReactNode }).children, type);
}

describe('ISR 설정', () => {
    it('세 라우트 모두 revalidate는 하루(86400) 리터럴이다', () => {
        expect([hubRevalidate, categoryRevalidate, entryRevalidate]).toEqual([
            86400, 86400, 86400,
        ]);
    });

    it('동적 세그먼트 라우트는 generateStaticParams가 빈 배열이다(on-demand ISR)', async () => {
        expect(await categoryStaticParams()).toEqual([]);
        expect(await entryStaticParams()).toEqual([]);
    });
});

describe('/guide', () => {
    it('ko는 색인하고 비-ko는 색인하지 않는다', async () => {
        expect((await hubMetadata(hubParams('ko'))).robots).toEqual(
            expect.objectContaining({ index: true })
        );
        expect((await hubMetadata(hubParams('en'))).robots).toEqual(
            expect.objectContaining({ index: false })
        );
    });

    it('제목·설명은 카탈로그 문구이고 설명에 항목 수가 들어간다', async () => {
        const metadata = await hubMetadata(hubParams());
        expect(metadata.title).toBe(ko.views.guide.hubSeoTitle);
        expect(metadata.description).toContain(String(CATALOG.entries.length));
    });

    it('canonical은 자기 자신이다', async () => {
        const metadata = await hubMetadata(hubParams());
        expect(metadata.alternates?.canonical).toBe(`${SITE_URL}/guide`);
    });

    it('CollectionPage + ItemList + BreadcrumbList를 싣는다', async () => {
        const nodes = collectJsonLdData(await GuideHubRoute(hubParams()));
        const collection = nodes.find(n => n['@type'] === 'CollectionPage');
        const list = collection?.mainEntity as {
            numberOfItems: number;
            itemListElement: { url: string }[];
        };
        expect(list.numberOfItems).toBe(CATALOG.entries.length);
        expect(list.itemListElement[1]?.url).toBe(
            `${SITE_URL}/guide/indicators/rsi`
        );
        expect(nodes.some(n => n['@type'] === 'BreadcrumbList')).toBe(true);
    });

    it('비-ko의 항목 URL은 로케일 접두사를 따른다', async () => {
        const nodes = collectJsonLdData(await GuideHubRoute(hubParams('en')));
        const collection = nodes.find(n => n['@type'] === 'CollectionPage');
        const list = collection?.mainEntity as {
            itemListElement: { url: string }[];
        };
        expect(list.itemListElement[0]?.url).toBe(
            `${SITE_URL}/en/guide/candlesticks/doji`
        );
    });

    describe('카탈로그를 못 읽으면', () => {
        beforeEach(() => setCatalog(null));

        it('500도 404도 아닌 안내 화면을 내고 revalidate를 낮춘다', async () => {
            const tree = await GuideHubRoute(hubParams());
            expect(isValidElement(tree) && tree.type).toBe(
                GuideUnavailablePage
            );
            expect(shortenRevalidateForBuildDegrade).toHaveBeenCalledTimes(1);
        });

        it('메타데이터는 noindex이고 자기 자신을 canonical로 둔다', async () => {
            const metadata = await hubMetadata(hubParams());
            expect(metadata.robots).toEqual({ index: false, follow: true });
            expect(metadata.alternates?.canonical).toBe(`${SITE_URL}/guide`);
            expect(metadata.alternates?.languages).toBeUndefined();
        });
    });
});

describe('/guide/[category]', () => {
    it('모르는 분류는 404다', async () => {
        await expect(
            GuideCategoryRoute(categoryParams('nope'))
        ).rejects.toThrow('NEXT_NOT_FOUND');
        await expect(categoryMetadata(categoryParams('nope'))).rejects.toThrow(
            'NEXT_NOT_FOUND'
        );
    });

    it('분류 제목·설명과 canonical을 낸다', async () => {
        const metadata = await categoryMetadata(categoryParams('indicators'));
        expect(metadata.title).toBe(ko.views.guide.categorySeoTitleIndicators);
        expect(metadata.description).toContain(
            ko.views.guide.categoryIndicators
        );
        expect(metadata.alternates?.canonical).toBe(
            `${SITE_URL}/guide/indicators`
        );
    });

    it('ItemList에는 그 분류의 항목만 싣는다', async () => {
        const nodes = collectJsonLdData(
            await GuideCategoryRoute(categoryParams('indicators'))
        );
        const collection = nodes.find(n => n['@type'] === 'CollectionPage');
        const list = collection?.mainEntity as { numberOfItems: number };
        expect(list.numberOfItems).toBe(2);
    });

    it('브레드크럼은 허브 › 분류 순서다', async () => {
        const nodes = collectJsonLdData(
            await GuideCategoryRoute(categoryParams('indicators'))
        );
        const crumbs = nodes.find(n => n['@type'] === 'BreadcrumbList')
            ?.itemListElement as { name: string }[];
        expect(crumbs.map(c => c.name)).toEqual([
            'SIGLENS',
            ko.views.guide.hubTitle,
            ko.views.guide.categoryIndicators,
        ]);
    });

    it('카탈로그를 못 읽으면 안내 화면 + noindex다', async () => {
        setCatalog(null);
        const tree = await GuideCategoryRoute(categoryParams('indicators'));
        expect(isValidElement(tree) && tree.type).toBe(GuideUnavailablePage);
        expect(
            (await categoryMetadata(categoryParams('indicators'))).robots
        ).toEqual({ index: false, follow: true });
    });
});

describe('/guide/[category]/[slug]', () => {
    it('없는 slug와 분류가 어긋난 slug는 404다', async () => {
        await expect(
            GuideEntryRoute(entryParams('indicators', 'ghost'))
        ).rejects.toThrow('NEXT_NOT_FOUND');
        await expect(
            GuideEntryRoute(entryParams('candlesticks', 'rsi'))
        ).rejects.toThrow('NEXT_NOT_FOUND');
        await expect(
            entryMetadata(entryParams('candlesticks', 'rsi'))
        ).rejects.toThrow('NEXT_NOT_FOUND');
    });

    it('메타데이터는 DB의 seoTitle·seoDescription이다', async () => {
        const metadata = await entryMetadata(entryParams('indicators', 'rsi'));
        expect(metadata.title).toBe(RSI.seoTitle);
        expect(metadata.description).toBe(RSI.seoDescription);
        expect(metadata.alternates?.canonical).toBe(
            `${SITE_URL}/guide/indicators/rsi`
        );
        expect(metadata.robots).toEqual(
            expect.objectContaining({ index: true })
        );
    });

    it('비-ko 로케일은 noindex이고 canonical에 접두사가 붙는다', async () => {
        const metadata = await entryMetadata(
            entryParams('indicators', 'rsi', 'en')
        );
        expect(metadata.robots).toEqual(
            expect.objectContaining({ index: false })
        );
        expect(metadata.alternates?.canonical).toBe(
            `${SITE_URL}/en/guide/indicators/rsi`
        );
    });

    it('소셜 카드 제목에는 브랜드를 붙인다', async () => {
        const metadata = await entryMetadata(entryParams('indicators', 'rsi'));
        expect(metadata.openGraph?.title).toBe(`${RSI.seoTitle} | SIGLENS`);
    });

    describe('JSON-LD', () => {
        it('TechArticle의 dateModified는 항목의 updatedAt이다', async () => {
            const nodes = collectJsonLdData(
                await GuideEntryRoute(entryParams('indicators', 'rsi'))
            );
            const article = nodes.find(n => n['@type'] === 'TechArticle');
            expect(article?.dateModified).toBe(RSI.updatedAt);
            expect(article?.headline).toBe('RSI');
            expect(article?.url).toBe(`${SITE_URL}/guide/indicators/rsi`);
            expect(article?.inLanguage).toBe('ko');
            expect(article).not.toHaveProperty('datePublished');
        });

        it('번역이 없어 ko 본문을 보여 주면 inLanguage는 ko다', async () => {
            setCatalog({
                entries: [guideEntry({ slug: 'rsi', isFallback: true })],
            });
            const nodes = collectJsonLdData(
                await GuideEntryRoute(entryParams('indicators', 'rsi', 'en'))
            );
            expect(
                nodes.find(n => n['@type'] === 'TechArticle')?.inLanguage
            ).toBe('ko');
        });

        it('FAQPage는 화면에 보이는 FAQ와 같은 질문·답변을 싣는다', async () => {
            const nodes = collectJsonLdData(
                await GuideEntryRoute(entryParams('indicators', 'rsi'))
            );
            const faq = nodes.find(n => n['@type'] === 'FAQPage');
            const entities = faq?.mainEntity as {
                name: string;
                acceptedAnswer: { text: string };
            }[];
            expect(entities.map(e => [e.name, e.acceptedAnswer.text])).toEqual(
                RSI.faq.map(item => [item.q, item.a])
            );
        });

        it('FAQ가 없으면 FAQPage를 내지 않는다', async () => {
            const nodes = collectJsonLdData(
                await GuideEntryRoute(entryParams('indicators', 'macd'))
            );
            expect(nodes.some(n => n['@type'] === 'FAQPage')).toBe(false);
        });

        it('브레드크럼은 허브 › 분류 › 항목이고 화면 브레드크럼과 이름이 같다', async () => {
            const nodes = collectJsonLdData(
                await GuideEntryRoute(entryParams('indicators', 'rsi'))
            );
            const crumbs = nodes.find(n => n['@type'] === 'BreadcrumbList')
                ?.itemListElement as { name: string; item: string }[];
            expect(crumbs.map(c => c.name)).toEqual([
                'SIGLENS',
                ko.views.guide.hubTitle,
                ko.views.guide.categoryIndicators,
                'RSI',
            ]);
            expect(crumbs[3]?.item).toBe(`${SITE_URL}/guide/indicators/rsi`);
        });
    });

    it('뷰에 해당 항목과 같은 로케일의 카탈로그를 넘긴다', async () => {
        const { GuideEntryPage } = await import('@/views/guide/GuideEntryPage');
        const props = findProps(
            await GuideEntryRoute(entryParams('indicators', 'rsi')),
            GuideEntryPage
        );
        expect(props?.entry).toBe(RSI);
        expect(props?.catalog).toBe(CATALOG.entries);
        expect(mockLoad).toHaveBeenCalledWith('ko');
    });

    describe('카탈로그를 못 읽으면', () => {
        beforeEach(() => setCatalog(null));

        it('404가 아니라 안내 화면이다', async () => {
            const tree = await GuideEntryRoute(
                entryParams('indicators', 'rsi')
            );
            expect(isValidElement(tree) && tree.type).toBe(
                GuideUnavailablePage
            );
            expect(shortenRevalidateForBuildDegrade).toHaveBeenCalledTimes(1);
        });

        it('메타데이터는 noindex이고 이 URL을 canonical로 둔다', async () => {
            const metadata = await entryMetadata(
                entryParams('indicators', 'rsi')
            );
            expect(metadata.robots).toEqual({ index: false, follow: true });
            expect(metadata.alternates?.canonical).toBe(
                `${SITE_URL}/guide/indicators/rsi`
            );
        });
    });
});
