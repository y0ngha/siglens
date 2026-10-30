import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { SEO_DESCRIPTION_MAX_LENGTH } from '@/shared/lib/seo';
import { MESSAGE_CATALOGS } from '@/shared/test-utils/messageCatalogs';

vi.mock('next-intl/server', () => ({
    getTranslations: vi.fn(
        async ({
            locale,
            namespace,
        }: {
            locale: 'ko' | 'en' | 'ja' | 'zh';
            namespace: string;
        }) =>
            createTranslator({
                locale,
                messages: MESSAGE_CATALOGS[locale],
                namespace,
            } as never)
    ),
}));

import { BENCHMARK_FIXTURE } from '@/entities/benchmark/__tests__/fixtures/benchmarkFixture';
import {
    buildBenchmarkDatasetJsonLd,
    getBenchmarkSeoCopy,
} from '../benchmarkSeo';

describe('getBenchmarkSeoCopy', () => {
    it('names the compared models in the title and description', async () => {
        const copy = await getBenchmarkSeoCopy('ko', BENCHMARK_FIXTURE);
        expect(copy.title).toBe(
            '주식 AI 정확도 벤치마크: 시그렌즈 AI vs BetaGPT, GammaGem'
        );
        expect(copy.description).toBe(
            '미국과 한국 주식 질문 4개를 시그렌즈 AI와 BetaGPT, GammaGem에 똑같이 묻고 시세와 공시로 만든 정답과 비교했습니다. 점수 차와 신뢰구간, 문항별 답변 원문을 공개합니다.'
        );
    });

    it('leaves the baseline out of the compared models', async () => {
        const copy = await getBenchmarkSeoCopy('en', BENCHMARK_FIXTURE);
        expect(copy.title).not.toContain('DeltaBase');
        expect(copy.description).not.toContain('DeltaBase');
    });

    it.each([
        ['ko', '차이 없음'],
        ['ja', '差なし'],
        ['zh', '无明显差异'],
    ] as const)(
        'never claims the %s inconclusive group has "no difference"',
        async (locale, forbidden) => {
            const copy = await getBenchmarkSeoCopy(locale, BENCHMARK_FIXTURE);
            expect(copy.description).not.toContain(forbidden);
        }
    );

    it.each(['ko', 'en', 'ja', 'zh'] as const)(
        'keeps the %s description within the SEO length limit',
        async locale => {
            const copy = await getBenchmarkSeoCopy(locale, BENCHMARK_FIXTURE);
            expect(copy.description.length).toBeLessThanOrEqual(
                SEO_DESCRIPTION_MAX_LENGTH
            );
        }
    );

    it('follows the locale for the brand and the model separator', async () => {
        const copy = await getBenchmarkSeoCopy('en', BENCHMARK_FIXTURE);
        expect(copy.title).toBe(
            'Stock AI accuracy benchmark: SIGLENS AI vs BetaGPT, GammaGem'
        );
        expect(copy.ogLabel).toBe('SIGLENS AI benchmark results');
        expect(copy.datasetName).toBe(
            'SIGLENS AI stock question benchmark 2099-01: questions, ground truth and raw answers'
        );
    });

    it('falls back to a plain description when there is no subject to compare', async () => {
        const copy = await getBenchmarkSeoCopy('ko', {
            ...BENCHMARK_FIXTURE,
            targets: BENCHMARK_FIXTURE.targets.filter(t => t.id !== 'siglens'),
        });
        expect(copy.description).toContain('4개');
        expect(copy.title).toBe(
            '시그렌즈 AI 벤치마크 결과: 범용 AI 모델과의 문항별 비교'
        );
    });
});

describe('buildBenchmarkDatasetJsonLd', () => {
    const copy = {
        title: 'T',
        description: 'D',
        ogLabel: 'O',
        datasetName: 'N',
        variableMeasured: 'V',
    };
    const input = {
        release: BENCHMARK_FIXTURE,
        copy,
        canonicalUrl: 'https://ai.test/benchmark',
        siteUrl: 'https://site.test',
        aiSiteUrl: 'https://ai.test',
        organizationId: 'https://site.test#organization',
    };

    it('anchors @id and url on the canonical page', () => {
        expect(buildBenchmarkDatasetJsonLd(input)).toMatchObject({
            '@type': 'Dataset',
            '@id': 'https://ai.test/benchmark#dataset',
            url: 'https://ai.test/benchmark',
        });
    });

    it('names the dataset itself, not the page, and versions it by round', () => {
        expect(buildBenchmarkDatasetJsonLd(input)).toMatchObject({
            name: 'N',
            description: 'D',
            variableMeasured: 'V',
            version: '2099-01',
        });
    });

    it('dates the dataset by the scoring date and covers the measurement day', () => {
        expect(buildBenchmarkDatasetJsonLd(input)).toMatchObject({
            dateModified: '2099-01-12',
            temporalCoverage: '2099-01-10',
        });
    });

    it('points distribution at the zip on the ai host', () => {
        expect(buildBenchmarkDatasetJsonLd(input)).toMatchObject({
            distribution: [
                {
                    name: 'benchmark-2099-01.zip',
                    contentUrl:
                        'https://ai.test/benchmark/2099-01/benchmark-2099-01.zip',
                },
            ],
            creator: {
                '@id': 'https://site.test#organization',
                '@type': 'Organization',
                url: 'https://site.test',
            },
            publisher: { '@id': 'https://site.test#organization' },
        });
    });

    it('ties creator and publisher to the same organization id', () => {
        const json = buildBenchmarkDatasetJsonLd(input) as {
            creator: { '@id': string };
            publisher: { '@id': string };
        };
        expect(json.creator['@id']).toBe(json.publisher['@id']);
    });

    it('declares the data licence as CC BY 4.0', () => {
        expect(buildBenchmarkDatasetJsonLd(input)).toMatchObject({
            license: 'https://creativecommons.org/licenses/by/4.0/',
        });
    });

    it('declares the data language as Korean', () => {
        expect(buildBenchmarkDatasetJsonLd(input)).toMatchObject({
            inLanguage: 'ko',
        });
    });
});
