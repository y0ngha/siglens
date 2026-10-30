import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { publicApiToolSpecs } from '@/app/api/v1/publicApiTools';
import { buildApiToolReferences } from '@/entities/siglens-api-key/lib/buildApiToolReferences';
import { isPublicApiEnabled } from '@/shared/api/publicApiEnabled';
import { DEVELOPERS_UPDATED_AT } from '@/shared/config/publicApi';
import { enterLocale } from '@/shared/lib/enterLocale';
import { formatKoreanDate } from '@/shared/lib/legal';
import { buildBreadcrumbJsonLd, SITE_URL } from '@/shared/lib/seo';
import { JsonLd } from '@/shared/ui/JsonLd';
import { DevelopersPage } from '@/views/developers/DevelopersPage';
import { buildDevelopersJsonLd } from '@/app/[locale]/developers/_lib/developersSeo';
import { DEVELOPERS_PAGE_URL } from '@/app/[locale]/developers/_lib/developersUrls';
import { buildDevelopersMetadata } from '@/app/[locale]/developers/_lib/developersMetadata';

// `/about`·`/methodology`와 같은 근거 — 본문이 메시지 카탈로그와 코드 상수(한도·오류 코드·도구 스펙)라
// 배포 자체가 갱신이므로 하루 재검증이면 충분하다. 라우트 세그먼트 설정은 리터럴이어야 한다.
// 이 페이지는 DB·Redis·외부 API를 읽지 않아 E2E처럼 데이터 저장소가 없는 환경에서도 렌더된다.
export const revalidate = 86400;

export async function generateMetadata({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    return buildDevelopersMetadata(params);
}

export default async function DevelopersRoute({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}) {
    if (!isPublicApiEnabled()) notFound();
    const { locale: rawLocale } = await params;
    const locale = enterLocale(rawLocale);
    const tSeo = await getTranslations({ locale, namespace: 'shared.seo' });

    // 도구 목록은 `/api/v1/openapi.json`·SKILL.md·`GET /tools`와 같은 소스(`publicApiToolSpecs`)다.
    // 외부 데이터가 없어 던질 일이 없다(순수 스펙 가공).
    const tools = buildApiToolReferences({
        baseUrl: SITE_URL,
        tools: publicApiToolSpecs(),
    });

    return (
        <>
            <JsonLd data={buildDevelopersJsonLd(tSeo, locale)} />
            <JsonLd
                data={buildBreadcrumbJsonLd(
                    [
                        {
                            name: tSeo('developers.title'),
                            url: DEVELOPERS_PAGE_URL,
                        },
                    ],
                    locale
                )}
            />
            <DevelopersPage
                locale={locale}
                title={tSeo('developers.title')}
                baseUrl={SITE_URL}
                tools={tools}
                updatedAt={formatKoreanDate(DEVELOPERS_UPDATED_AT, locale)}
            />
        </>
    );
}
