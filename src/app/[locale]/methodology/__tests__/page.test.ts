/**
 * 뷰는 목으로 바꾼다 — 화면은 `views/methodology` 스위트가 검사하고, 여기서는
 * 라우트가 넘기는 props(카운트·갱신일)와 메타데이터·JSON-LD만 본다.
 * `buildWebPageJsonLd`·`buildBreadcrumbJsonLd`·`legal`은 **실제 구현**을 쓴다 —
 * 스텁으로 갈아끼우면 `dateModified`·`@id` 배선이 아니라 스텁을 검사하게 된다.
 */
vi.mock('@/views/methodology/MethodologyPage', () => ({
    MethodologyPage: () => null,
}));
/**
 * 부분 목이다 — `METHODOLOGY_UPDATED_AT`만 `/about`의 갱신일과 **다른 날**로 바꾼다.
 * 실제 두 상수가 같은 날이면 `dateModified`·"마지막 업데이트"가 엉뚱하게
 * `ABOUT_UPDATED_AT`을 읽어도 테스트가 그대로 통과한다. 나머지(`@id`·경로·
 * `formatKoreanDate`)는 실제 구현이다.
 */
vi.mock('@/shared/lib/legal', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/lib/legal')>()),
    METHODOLOGY_UPDATED_AT: new Date('2026-10-07T00:00:00+09:00'),
}));
vi.mock('@/shared/lib/og', () => ({
    OG_IMAGE_WIDTH: 1200,
    OG_IMAGE_HEIGHT: 630,
}));
vi.mock('@/entities/skill/api', () => ({
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

import {
    generateMetadata,
    default as MethodologyRoute,
    revalidate,
} from '@/app/[locale]/methodology/page';
import { isValidElement, type ReactNode } from 'react';
import { collectJsonLdData } from '@/__tests__/utils/collectJsonLdData';
import {
    METHODOLOGY_PATH,
    METHODOLOGY_UPDATED_AT,
    OPERATOR_PERSON_JSON_LD_ID,
} from '@/shared/lib/legal';
import { ORGANIZATION_JSON_LD_ID, SITE_URL } from '@/shared/lib/seo';
import ko from '../../../../../messages/ko.json';

interface ViewProps {
    readonly counts: { indicators: number };
    readonly updatedAt: string;
    readonly title: string;
}

/** 뷰가 목이라 렌더할 수 없다 — element tree에서 `MethodologyPage`에 넘긴 props를 찾는다. */
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
    if (props.counts !== undefined) return props as ViewProps;
    return findViewProps(props.children);
}

const renderRoute = (locale = 'ko') =>
    MethodologyRoute({ params: Promise.resolve({ locale }) });

const metadataFor = (locale = 'ko') =>
    generateMetadata({ params: Promise.resolve({ locale }) });

describe('Methodology page', () => {
    it('revalidate는 /about과 같은 하루(86400초) 리터럴이다', () => {
        expect(revalidate).toBe(86400);
    });

    it('메타 타이틀은 레이아웃 템플릿을 타지 않는다 — 이미 Siglens로 시작한다', async () => {
        const metadata = await metadataFor();
        expect(metadata.title).toEqual({
            absolute: ko.shared.seo.methodology.metaTitle,
        });
        expect(ko.shared.seo.methodology.metaTitle).toMatch(/^Siglens/);
    });

    it('설명은 카탈로그의 shared.seo.methodology.description이다', async () => {
        const metadata = await metadataFor();
        expect(metadata.description).toBe(
            ko.shared.seo.methodology.description
        );
    });

    it('ko는 색인을 허용한다', async () => {
        const metadata = await metadataFor('ko');
        expect(metadata.robots).toEqual(
            expect.objectContaining({ index: true })
        );
    });

    it('비-ko 로케일은 색인하지 않는다(STATIC_INDEXABLE_LOCALES 밖)', async () => {
        const metadata = await metadataFor('en');
        expect(metadata.robots).toEqual(
            expect.objectContaining({ index: false })
        );
    });

    it('자기 자신을 canonical로 가리킨다', async () => {
        const metadata = await metadataFor();
        expect(metadata.alternates?.canonical).toBe(
            `${SITE_URL}${METHODOLOGY_PATH}`
        );
    });

    it('openGraph는 article이고 twitter는 summary다', async () => {
        const metadata = await metadataFor();
        expect(metadata.openGraph).toEqual(
            expect.objectContaining({ type: 'article' })
        );
        expect(metadata.twitter).toEqual(
            expect.objectContaining({ card: 'summary' })
        );
    });

    it('WebPage JSON-LD가 dateModified·publisher·author를 @id 참조로 싣는다', async () => {
        const nodes = collectJsonLdData(await renderRoute());

        const webPage = nodes.find(n => n['@type'] === 'WebPage');
        expect(webPage).toBeDefined();
        expect(webPage?.url).toBe(`${SITE_URL}${METHODOLOGY_PATH}`);
        expect(webPage?.dateModified).toBe('2026-10-06T15:00:00.000Z');
        expect(webPage?.dateModified).toBe(
            METHODOLOGY_UPDATED_AT.toISOString()
        );
        expect(webPage?.publisher).toEqual({ '@id': ORGANIZATION_JSON_LD_ID });
        expect(webPage?.author).toEqual({ '@id': OPERATOR_PERSON_JSON_LD_ID });
    });

    it('author 참조는 /about의 Person이 쓰는 @id와 문자 그대로 같다', () => {
        expect(OPERATOR_PERSON_JSON_LD_ID).toBe(`${SITE_URL}/about#person`);
    });

    it('BreadcrumbList를 내보내고 FAQPage는 내보내지 않는다', async () => {
        const nodes = collectJsonLdData(await renderRoute());
        const crumb = nodes.find(n => n['@type'] === 'BreadcrumbList');
        expect(crumb).toBeDefined();
        const items = crumb?.itemListElement as { name: string }[];
        expect(items.at(-1)?.name).toBe(ko.shared.seo.methodology.title);
        expect(nodes.some(n => n['@type'] === 'FAQPage')).toBe(false);
    });

    it('/about과 같은 소스(countSkillFiles)의 카운트와 갱신일을 뷰에 넘긴다', async () => {
        const view = findViewProps(await renderRoute());
        expect(view?.counts.indicators).toBe(13);
        expect(view?.title).toBe(ko.shared.seo.methodology.title);
        expect(view?.updatedAt).toBe('2026년 10월 7일');
    });

    it('countSkillFiles가 실패해도 0 카운트로 렌더한다', async () => {
        const { countSkillFiles } = await import('@/entities/skill/api');
        vi.mocked(countSkillFiles).mockRejectedValueOnce(new Error('boom'));
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        const view = findViewProps(await renderRoute());
        const calls = [...errorSpy.mock.calls];
        errorSpy.mockRestore();
        expect(view?.counts.indicators).toBe(0);
        expect(
            calls.some(
                call => call[0] === '[MethodologyPage] countSkillFiles failed:'
            )
        ).toBe(true);
    });
});
