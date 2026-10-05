import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { useTranslations } from 'next-intl';
import { resolveLocale } from '@/shared/i18n/locales';
// 레포 규칙: 라우트에서 next/link 직접 import 금지 — 로케일 접두를 붙이는 LocaleLink만 쓴다
// (`src/app/[locale]/NotFoundContent.tsx`와 동일). 가드: shared/ui/__tests__/noRawNextLink.test.ts
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';

/**
 * 404 제목도 로케일을 따른다. 정적 `metadata`가 없으면 레이아웃의 기본 제목(제품명)을
 * 그대로 상속해, 존재하지 않는 대화·경로가 전부 홈과 같은 `<title>`이 된다. 레이아웃이
 * `robots: noindex`를 기본으로 두지만 404 응답까지 확실히 덮도록 여기서도 선언한다.
 */
export async function generateMetadata({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({
        locale: resolveLocale(locale),
        namespace: 'app.ai',
    });
    return {
        title: t('not-found.047c35'),
        robots: { index: false, follow: false },
    };
}

export default function AiNotFound() {
    const t = useTranslations('app.ai');
    return (
        <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-center justify-center gap-3 px-4 text-center">
            <h1 className="text-xl font-semibold text-secondary-100">
                {t('not-found.047c35')}
            </h1>
            <Link
                href="/"
                className="text-primary-400 underline focus-visible:ring-2 focus-visible:ring-primary-500"
            >
                {t('not-found.04598e')}
            </Link>
        </main>
    );
}
