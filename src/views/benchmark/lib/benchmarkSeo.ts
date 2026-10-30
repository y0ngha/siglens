/**
 * 벤치마크 페이지의 SEO 문구와 Dataset JSON-LD. 두 호스트 라우트가 함께 쓴다.
 */
import { getTranslations } from 'next-intl/server';
import { buildBenchmarkHeadline } from '@/entities/benchmark/lib/benchmarkHeadline';
import type { BenchmarkRelease } from '@/entities/benchmark/types';
import type { AiSeoCopy } from '@/shared/config/aiHost';
import { SITE_NAME } from '@/shared/config/brand';
import { LOCALE_HREFLANG, type Locale } from '@/shared/i18n/locales';
import { brandAiName } from '@/shared/lib/brandName';
import { clampSeoDescription } from '@/shared/lib/seoClamp';
import { formatBenchmarkDate } from '@/shared/lib/benchmarkFormat';
import { BENCHMARK_DATA_LICENSE_URL } from '@/shared/config/benchmark';

/** 두 호스트 라우트의 메타데이터·JSON-LD가 쓰는 문구. */
export interface BenchmarkSeoCopy extends AiSeoCopy {
    /** Dataset JSON-LD 전용 — 페이지 제목이 아니라 데이터셋 자체의 이름. */
    readonly datasetName: string;
    readonly variableMeasured: string;
}

/**
 * 두 호스트 라우트가 같은 문구로 메타데이터를 만들도록 한 곳에서 낸다. 제목·설명의 비교 모델
 * 이름은 헤드라인과 같은 소스(`buildBenchmarkHeadline`)에서 와서 화면과 어긋나지 않는다.
 */
export async function getBenchmarkSeoCopy(
    locale: Locale,
    release: BenchmarkRelease
): Promise<BenchmarkSeoCopy> {
    const t = await getTranslations({ locale, namespace: 'views.benchmark' });
    const headline = buildBenchmarkHeadline(release);
    const brand = brandAiName(locale);
    const models = (headline?.competitors ?? [])
        .map(entry => entry.target.label)
        .join(t('seo.modelSeparator'));
    const description =
        models === ''
            ? t('seo.descriptionPlain', { brand, items: release.items.length })
            : t('seo.description', {
                  brand,
                  models,
                  items: release.items.length,
              });
    return {
        title:
            models === ''
                ? t('seo.titlePlain', { brand })
                : t('seo.title', { brand, models }),
        description: clampSeoDescription(description),
        ogLabel: t('seo.ogLabel', { brand }),
        datasetName: t('seo.datasetName', { brand, round: release.round }),
        variableMeasured: t('seo.variableMeasured'),
    };
}

interface DatasetInput {
    readonly release: BenchmarkRelease;
    readonly copy: BenchmarkSeoCopy;
    /** 정본 URL(ai 호스트). 두 호스트의 사본이 같은 `@id`·`url`을 쓴다. */
    readonly canonicalUrl: string;
    readonly siteUrl: string;
    readonly aiSiteUrl: string;
    /** 발행 주체 Organization의 `@id`. */
    readonly organizationId: string;
}

/**
 * `Dataset` JSON-LD. 두 호스트 라우트가 같은 값을 낸다 — `@id`·`url`이 정본 URL이라 사본을
 * 읽은 크롤러도 같은 개체로 묶는다. `dateModified`는 채점 확정일이다.
 */
export function buildBenchmarkDatasetJsonLd({
    release,
    copy,
    canonicalUrl,
    siteUrl,
    aiSiteUrl,
    organizationId,
}: DatasetInput): Record<string, unknown> {
    return {
        '@context': 'https://schema.org',
        '@type': 'Dataset',
        '@id': `${canonicalUrl}#dataset`,
        name: copy.datasetName,
        description: copy.description,
        url: canonicalUrl,
        version: release.round,
        variableMeasured: copy.variableMeasured,
        // 문항·답변 원문이 한국어다. 페이지 UI 언어와 데이터 언어는 다르다.
        inLanguage: LOCALE_HREFLANG.ko,
        isAccessibleForFree: true,
        dateModified: formatBenchmarkDate(release.scoredAt),
        temporalCoverage: formatBenchmarkDate(release.measuredAt),
        // creator와 publisher는 같은 Organization이라 같은 `@id`로 묶는다.
        creator: {
            '@id': organizationId,
            '@type': 'Organization',
            name: SITE_NAME,
            url: siteUrl,
        },
        license: BENCHMARK_DATA_LICENSE_URL,
        publisher: { '@id': organizationId },
        distribution: [
            {
                '@type': 'DataDownload',
                name: release.downloads.zipPath.split('/').at(-1),
                encodingFormat: 'application/zip',
                contentUrl: `${aiSiteUrl}${release.downloads.zipPath}`,
            },
        ],
    };
}
