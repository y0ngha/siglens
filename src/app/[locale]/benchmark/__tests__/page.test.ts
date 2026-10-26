/**
 * 뷰는 목으로 바꾼다 — 화면은 `views/benchmark` 스위트가 검사하고, 여기서는 게이트,
 * 라우트가 넘기는 props, 메타데이터, JSON-LD만 본다. 릴리스 모듈은 게이트 값만 바꿔 끼운다.
 */
const state = vi.hoisted(() => ({ release: null as unknown }));

vi.mock('@/entities/benchmark/release', () => ({
    getPublishedBenchmarkRelease: () => state.release,
}));
vi.mock('@/views/benchmark/BenchmarkPage', () => ({
    BenchmarkPage: () => null,
}));
vi.mock('next/navigation', () => ({
    notFound: vi.fn(() => {
        throw new Error('NEXT_NOT_FOUND');
    }),
}));

import { isValidElement, type ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { collectJsonLdData } from '@/__tests__/utils/collectJsonLdData';
import { BENCHMARK_FIXTURE } from '@/entities/benchmark/__tests__/fixtures/benchmarkFixture';
import {
    generateMetadata,
    default as BenchmarkRoute,
    revalidate,
} from '@/app/[locale]/benchmark/page';
import { default as AiBenchmarkRoute } from '@/app/ai/[locale]/benchmark/page';
import { AI_SITE_URL } from '@/shared/config/aiHost';
import { ORGANIZATION_JSON_LD_ID, SITE_URL } from '@/shared/lib/seo';
import ko from '../../../../../messages/ko.json';

const params = (locale = 'ko') => ({ params: Promise.resolve({ locale }) });

interface ViewProps {
    readonly release: unknown;
    readonly siteUrl: string;
    readonly aiSiteUrl: string;
    readonly locale: string;
}

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
    if (props.aiSiteUrl !== undefined) return props as ViewProps;
    return findViewProps(props.children);
}

describe('siglens.io/benchmark route', () => {
    beforeEach(() => {
        state.release = null;
        vi.mocked(notFound).mockClear();
    });

    it('revalidates daily with a literal', () => {
        expect(revalidate).toBe(86400);
    });

    describe('while the gate is shut', () => {
        it('404s the page', async () => {
            await expect(BenchmarkRoute(params())).rejects.toThrow(
                'NEXT_NOT_FOUND'
            );
            expect(notFound).toHaveBeenCalledTimes(1);
        });

        it('404s the metadata too', async () => {
            await expect(generateMetadata(params())).rejects.toThrow(
                'NEXT_NOT_FOUND'
            );
        });
    });

    describe('once published', () => {
        beforeEach(() => {
            state.release = BENCHMARK_FIXTURE;
        });

        it('indexes ko and points its canonical at the ai host, declaring nothing else', async () => {
            const metadata = await generateMetadata(params('ko'));
            expect(metadata.robots).toMatchObject({ index: true });
            expect(metadata.alternates).toEqual({
                canonical: `${AI_SITE_URL}/benchmark`,
            });
        });

        it('never mixes noindex with a canonical: en is noindex with canonical null', async () => {
            const metadata = await generateMetadata(params('en'));
            expect(metadata.robots).toMatchObject({ index: false });
            expect(metadata.alternates).toEqual({ canonical: null });
        });

        it('keeps the locale prefix in og:url even when the canonical is dropped', async () => {
            const metadata = await generateMetadata(params('en'));
            expect(metadata.openGraph).toMatchObject({
                url: `${AI_SITE_URL}/en/benchmark`,
            });
        });

        it('uses the ai URL for og:url', async () => {
            const metadata = await generateMetadata(params());
            expect(metadata.openGraph).toMatchObject({
                url: `${AI_SITE_URL}/benchmark`,
                type: 'website',
                images: [
                    expect.objectContaining({
                        url: `${AI_SITE_URL}/api/ai/og/ko.png`,
                    }),
                ],
            });
        });

        it('indexes Korean and keeps other locales out of the index', async () => {
            expect((await generateMetadata(params('ko'))).robots).toMatchObject(
                { index: true }
            );
            expect((await generateMetadata(params('en'))).robots).toMatchObject(
                { index: false }
            );
        });

        it('writes every metadata field explicitly (AP-3)', async () => {
            const metadata = await generateMetadata(params());
            expect(metadata.title).toEqual({
                absolute: expect.stringContaining('벤치마크'),
            });
            expect(metadata.description).toEqual(expect.any(String));
            expect(metadata.robots).toBeDefined();
            expect(metadata.twitter).toBeDefined();
        });

        it('builds the description from the data', async () => {
            const metadata = await generateMetadata(params());
            expect(metadata.description).toContain('4개');
            expect(metadata.description).toContain('BetaGPT, GammaGem');
        });

        it('hands the same props to the view as the ai route', async () => {
            const main = findViewProps(await BenchmarkRoute(params()));
            const ai = findViewProps(await AiBenchmarkRoute(params()));
            expect(main).toEqual(ai);
            expect(main).toMatchObject({
                release: BENCHMARK_FIXTURE,
                siteUrl: SITE_URL,
                aiSiteUrl: AI_SITE_URL,
                locale: 'ko',
            });
        });

        it('emits a Dataset whose @id and url are the ai URL', async () => {
            const [dataset] = collectJsonLdData(await BenchmarkRoute(params()));
            expect(dataset).toMatchObject({
                '@type': 'Dataset',
                '@id': `${AI_SITE_URL}/benchmark#dataset`,
                url: `${AI_SITE_URL}/benchmark`,
                dateModified: '2099-01-12',
                temporalCoverage: '2099-01-10',
                inLanguage: 'ko',
                publisher: { '@id': ORGANIZATION_JSON_LD_ID },
                distribution: [
                    {
                        '@type': 'DataDownload',
                        encodingFormat: 'application/zip',
                        contentUrl: `${AI_SITE_URL}/benchmark/2099-01/benchmark-2099-01.zip`,
                    },
                ],
            });
            expect((dataset as { name: string }).name).toBe(
                ko.views.benchmark.seo.datasetName
                    .replace('{brand}', '시그렌즈 AI')
                    .replace('{round}', BENCHMARK_FIXTURE.round)
            );
        });

        it('emits the same Dataset on both hosts', async () => {
            expect(collectJsonLdData(await BenchmarkRoute(params()))).toEqual(
                collectJsonLdData(await AiBenchmarkRoute(params()))
            );
        });
    });
});
