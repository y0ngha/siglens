import { useTranslations } from 'next-intl';
// 레포 규칙: 라우트에서 next/link 직접 import 금지 — 로케일 접두를 붙이는 LocaleLink만 쓴다
// (`src/app/[locale]/NotFoundContent.tsx`와 동일). 가드: shared/ui/__tests__/noRawNextLink.test.ts
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';

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
