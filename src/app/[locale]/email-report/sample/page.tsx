import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { buildSampleReportEmail } from '@/entities/email-report/server';
import { EmailReportSampleView } from '@/features/email-report-sample/ui/EmailReportSampleView';
import { toSampleSrcDoc } from '@/features/email-report-sample/lib/toSampleSrcDoc';
import { resolveLocale } from '@/shared/i18n/locales';
import { enterLocale } from '@/shared/lib/enterLocale';
import { localeCanonical, localePageSocial } from '@/shared/lib/seoAlternates';

const PATH = '/email-report/sample';

/** 샘플은 고정 데이터와 번역 카탈로그로만 만들어져 배포 자체가 갱신이다 — 하루 재검증이면 충분하다. */
export const revalidate = 86400; // 1d

/**
 * 비회원이 메일 리포트를 미리 보는 페이지 — 색인하지 않지만(가입 동선의 보조 화면이고
 * 본문이 예시 데이터라 검색 결과에 낼 가치가 없다) 링크는 따라가게 둔다.
 */
export async function generateMetadata({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale: rawLocale } = await params;
    const locale = resolveLocale(rawLocale);
    const t = await getTranslations({
        locale,
        namespace: 'app.email-report.sample',
    });
    const title = t('page.title');
    const description = t('page.description');
    return {
        title,
        description,
        alternates: { canonical: localeCanonical(locale, PATH) },
        ...localePageSocial(locale, PATH, { title, description }),
        robots: { index: false, follow: true },
    };
}

/**
 * 로그인 없이 열린다. 쿠키·헤더를 읽지 않아 정적으로 남는다 — 프록시의 인증 가드
 * (`AUTH_REQUIRED_PATHS`)에도 걸리지 않는다(`/email-report` 설정 페이지의 로그인 이동은
 * 그 페이지 컴포넌트 안에서만 일어난다).
 */
export default async function EmailReportSamplePage({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}) {
    const { locale: rawLocale } = await params;
    const locale = enterLocale(rawLocale);
    const email = await buildSampleReportEmail(locale);
    return <EmailReportSampleView srcDoc={toSampleSrcDoc(email.html)} />;
}
