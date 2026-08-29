/**
 * 404 본문. **서버 컴포넌트다.**
 *
 * `'use client'`였을 때는 본문이 SSR HTML에 전혀 나오지 않고 RSC flight로만
 * 실려, 모든 404가 제목만 있는 **빈 페이지**로 나갔다(한국어 사용자 포함).
 * 상태 코드는 404로 정확해서 상태만 보는 검사로는 드러나지 않았다.
 *
 * 서버에서 `useTranslations`를 써도 안전한 이유: 이 컴포넌트가 렌더될 시점에는
 * `[locale]/layout.tsx`가 이미 `setRequestLocale(locale)`을 호출한 뒤다. 요청
 * 스코프 로케일이 잡혀 있으므로 next-intl이 `headers()`로 폴백하지 않는다.
 * `loading.tsx`와 다른 점이 여기다 — 그쪽은 Suspense fallback이라 레이아웃보다
 * 먼저 그려질 수 있어 `DYNAMIC_SERVER_USAGE`가 났다.
 */
import { useTranslations } from 'next-intl';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { SITE_NAME } from '@/shared/lib/seo';
import { ContactDialog } from '@/widgets/layout/ContactDialog';
// 배럴(`@/widgets/home`)이 아니라 파일을 직접 가리킨다. 배럴을 타면 홈 전체가
// 이 404 경계의 모듈 폐포에 들어오고, 그러면 홈 전용 스킬 카탈로그(8.4KB)가
// **크롬 페이로드**에 실려 `/login`·`/terms`까지 따라다닌다(실측: 크롬이
// 카탈로그의 23.8%). 프로덕션 코드의 배럴-only 규칙에 대한 의도적 예외다.
import { TickerCategories } from '@/widgets/home/TickerCategories';

export function NotFoundContent() {
    const t = useTranslations('app.home');
    return (
        <>
            <main className="flex flex-1 flex-col">
                <div className="flex flex-col items-center px-6 py-20 text-center">
                    <p className="font-mono text-sm tracking-widest text-primary-400">
                        404
                    </p>
                    <h1 className="mt-4 text-2xl font-bold text-secondary-100 sm:text-3xl">
                        {t('not-found.6cbd6d')}
                    </h1>
                    <p className="mt-3 max-w-md text-sm leading-relaxed text-secondary-400">
                        {t('not-found.03ecab')}
                    </p>

                    <Link
                        href="/"
                        className="mt-8 rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700"
                    >
                        {t('not-found.ba81f0', { v0: SITE_NAME })}
                    </Link>

                    <div className="mt-10 border-t border-secondary-700 pt-8">
                        <p className="text-sm text-secondary-400">
                            {t('not-found.f4b235')}
                        </p>
                        <p className="mt-1 text-xs text-secondary-600">
                            {t('not-found.f8a2cd')}
                        </p>
                        <ContactDialog
                            triggerLabel={t('not-found.4da438')}
                            triggerClassName="text-primary-400 hover:text-primary-300 mt-3 inline-block text-xs transition-colors"
                        />
                    </div>
                </div>
                <TickerCategories />
            </main>
        </>
    );
}
