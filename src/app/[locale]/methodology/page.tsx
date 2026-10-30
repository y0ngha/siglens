import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { countSkillFiles } from '@/entities/skill/api';
import { enterLocale } from '@/shared/lib/enterLocale';
import {
    formatKoreanDate,
    METHODOLOGY_UPDATED_AT,
    methodologyTitle,
} from '@/shared/lib/legal';
import { JsonLd } from '@/shared/ui/JsonLd';
import { EMPTY_SKILL_COUNTS } from '@/views/about/lib/aboutContent';
import { MethodologyPage } from '@/views/methodology/MethodologyPage';
import {
    buildMethodologyBreadcrumbJsonLd,
    buildMethodologyJsonLd,
} from '@/app/[locale]/methodology/_lib/methodologyJsonLd';
import { buildMethodologyMetadata } from '@/app/[locale]/methodology/_lib/methodologyMetadata';

// `/about`·`/terms`와 같은 근거 — 본문이 메시지 카탈로그와 코드 상수라 배포 자체가
// 갱신이므로 하루 재검증이면 충분하다. 라우트 세그먼트 설정은 리터럴이어야 한다(AP-1).
export const revalidate = 86400;

export async function generateMetadata({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    return buildMethodologyMetadata(params);
}

export default async function MethodologyRoute({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}) {
    const { locale: rawLocale } = await params;
    const locale = enterLocale(rawLocale);

    // `countSkillFiles` 오류는 graceful 처리 — 0 폴백으로 페이지를 계속 렌더한다.
    // throw가 전파되면 ISR 빈 캐시(0-byte body)가 동결된다(`/about`·홈과 같은 근거).
    const [tSeo, counts] = await Promise.all([
        getTranslations({ locale, namespace: 'shared.seo' }),
        countSkillFiles().catch(e => {
            console.error('[MethodologyPage] countSkillFiles failed:', e);
            return EMPTY_SKILL_COUNTS;
        }),
    ]);

    return (
        <>
            <JsonLd data={buildMethodologyJsonLd(tSeo, locale)} />
            <JsonLd data={buildMethodologyBreadcrumbJsonLd(tSeo, locale)} />
            <MethodologyPage
                locale={locale}
                title={methodologyTitle(tSeo)}
                counts={counts}
                updatedAt={formatKoreanDate(METHODOLOGY_UPDATED_AT, locale)}
            />
        </>
    );
}
