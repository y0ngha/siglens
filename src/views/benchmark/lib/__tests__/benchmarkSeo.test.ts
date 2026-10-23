import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import ko from '../../../../../messages/ko.json';
import en from '../../../../../messages/en.json';
import ja from '../../../../../messages/ja.json';
import zh from '../../../../../messages/zh.json';
import { SEO_DESCRIPTION_MAX_LENGTH } from '@/shared/lib/seo';

const CATALOGS = { ko, en, ja, zh } as const;

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
                messages: CATALOGS[locale],
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
    it('writes the description from the headline counts', async () => {
        const copy = await getBenchmarkSeoCopy('ko', BENCHMARK_FIXTURE);
        expect(copy.description).toBe(
            '미국·한국 주식 질문 4개로 시그렌즈 AI와 범용 AI 모델 2종을 비교했습니다. 유의하게 앞선 모델 1종, 차이를 확정하지 못한 모델 1종, 뒤처짐 0종. 문항·정답·답변 원문 공개.'
        );
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

    it('follows the locale for the brand in the title', async () => {
        const copy = await getBenchmarkSeoCopy('en', BENCHMARK_FIXTURE);
        expect(copy.title).toBe(
            'SIGLENS AI benchmark results — question-by-question comparison with general AI models'
        );
        expect(copy.ogLabel).toBe('SIGLENS AI benchmark results');
    });

    it('falls back to a plain description when there is no subject to compare', async () => {
        const copy = await getBenchmarkSeoCopy('ko', {
            ...BENCHMARK_FIXTURE,
            targets: BENCHMARK_FIXTURE.targets.filter(t => t.id !== 'siglens'),
        });
        expect(copy.description).toContain('4개');
        expect(copy.description).not.toContain('유의하게');
    });
});

describe('buildBenchmarkDatasetJsonLd', () => {
    const copy = { title: 'T', description: 'D', ogLabel: 'O' };
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

    it('takes name and description from the shared copy', () => {
        expect(buildBenchmarkDatasetJsonLd(input)).toMatchObject({
            name: 'T',
            description: 'D',
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
