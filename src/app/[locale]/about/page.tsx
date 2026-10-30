import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { countSkillFiles } from '@/entities/skill/api';
import { getPublishedBenchmarkRelease } from '@/entities/benchmark/release';
import { enterLocale } from '@/shared/lib/enterLocale';
import {
    aboutTitle,
    ABOUT_UPDATED_AT,
    formatKoreanDate,
} from '@/shared/lib/legal';
import { buildFaqJsonLd } from '@/shared/lib/seo';
import { JsonLd } from '@/shared/ui/JsonLd';
import { AboutPage } from '@/views/about/AboutPage';
import {
    EMPTY_SKILL_COUNTS,
    getAboutFaq,
} from '@/views/about/lib/aboutContent';
import {
    buildAboutBreadcrumbJsonLd,
    buildAboutJsonLd,
    buildAboutPersonJsonLd,
} from '@/app/[locale]/about/_lib/aboutJsonLd';
import { buildAboutMetadata } from '@/app/[locale]/about/_lib/aboutMetadata';

// 본문이 메시지 카탈로그와 코드 상수라 배포 자체가 갱신이므로, 하루 재검증이면 충분하다
// (`/methodology`·`/terms`·`/privacy`와 같은 근거). 라우트 세그먼트 설정은 리터럴이어야 한다(AP-1).
export const revalidate = 86400;

export async function generateMetadata({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    return buildAboutMetadata(params);
}

export default async function AboutRoute({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}) {
    const { locale: rawLocale } = await params;
    const locale = enterLocale(rawLocale);

    // countSkillFiles 오류는 graceful 처리 — 0 폴백으로 페이지를 계속 렌더한다.
    // throw가 전파되면 ISR 빈 캐시(0-byte body)가 동결된다((home)/_lib/homeSkills.ts와 동일 근거).
    // FAQ는 화면 FaqSection과 FAQPage JSON-LD의 단일 소스 — 두 번 만들지 않는다.
    const [tSeo, counts, faq] = await Promise.all([
        getTranslations({ locale, namespace: 'shared.seo' }),
        countSkillFiles().catch(e => {
            console.error('[AboutPage] countSkillFiles failed:', e);
            return EMPTY_SKILL_COUNTS;
        }),
        getAboutFaq(locale),
    ]);

    return (
        <>
            <JsonLd data={buildAboutJsonLd(tSeo, locale)} />
            <JsonLd data={buildAboutPersonJsonLd()} />
            <JsonLd data={buildAboutBreadcrumbJsonLd(tSeo, locale)} />
            <JsonLd data={buildFaqJsonLd(faq)} />
            <AboutPage
                locale={locale}
                title={aboutTitle(tSeo)}
                counts={counts}
                faq={faq}
                updatedAt={formatKoreanDate(ABOUT_UPDATED_AT, locale)}
                benchmark={getPublishedBenchmarkRelease()}
            />
        </>
    );
}
