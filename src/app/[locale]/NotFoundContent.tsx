import { useTranslations } from 'next-intl';
import { ContactDialog } from '@/widgets/layout/ContactDialog';
import { SymbolSearchPanel } from '@/features/ticker-search/ui/SymbolSearchPanel';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { brandName } from '@/shared/lib/brandName';
import { cn } from '@/shared/lib/cn';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { NotFoundMessage } from './NotFoundMessage';

const CONTINUE_LINK_CLASSES = cn(
    'rounded-full border border-border-control px-4 py-1.5 text-xs text-secondary-300',
    'transition-colors hover:border-primary-500 hover:text-primary-400',
    'focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none'
);

/**
 * 로케일 404 본문(`[locale]/not-found.tsx`) — 헤드라인, 홈 링크, 종목 검색,
 * 허브 바로가기, 연락처. **서버 컴포넌트다** — 클라이언트 컴포넌트면 본문이
 * SSR HTML에 나오지 않고 RSC flight로만 실린다.
 *
 * 서버에서 `useTranslations`를 써도 안전한 이유: 이 컴포넌트가 렌더될 시점에는
 * `[locale]/layout.tsx`가 이미 `setRequestLocale(locale)`을 호출한 뒤다. 요청
 * 스코프 로케일이 잡혀 있으므로 next-intl이 `headers()`로 폴백하지 않는다.
 * `loading.tsx`와 다른 점이 여기다 — 그쪽은 Suspense fallback이라 레이아웃보다
 * 먼저 그려질 수 있어 `DYNAMIC_SERVER_USAGE`가 났다.
 *
 * 헤드라인만 클라이언트 아일랜드(`NotFoundMessage`)다 — 경로별 문구 분기에
 * `usePathname()`이 필요하다.
 */
export function NotFoundContent() {
    const t = useTranslations('app.home');
    const locale = useResolvedLocale();
    return (
        <main className="flex flex-1 flex-col">
            <div className="flex flex-col items-center px-6 py-20 text-center">
                <NotFoundMessage />

                <Link
                    href="/"
                    className="mt-8 rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                >
                    {t('not-found.ba81f0', { v0: brandName(locale) })}
                </Link>

                <p className="mt-10 text-sm text-secondary-400">
                    {t('NotFoundContent.4d8d9f')}
                </p>
                <SymbolSearchPanel className="mt-4 max-w-md" />
                {/*
                    카테고리 그리드(`TickerCategories`, 링크 85개)를 대신한다 — 404는
                    "여기엔 없다"를 말하는 페이지인데 그 아래 사이트 전체 링크 묶음을
                    두면 크롤러에게는 404가 허브처럼 보이고, 사용자에게는 원래 찾던
                    것과 무관한 벽이 된다. 허브 둘만 남긴다.
                    키는 리터럴로 적는다 — 동적 키를 쓰면 추출기가 `app.home`
                    네임스페이스를 통째로 넓혀 홈 FAQ 카탈로그까지 딸려 온다.
                */}
                <div className="mt-4 flex flex-wrap justify-center gap-3">
                    <Link
                        href="/market"
                        prefetch={false}
                        className={CONTINUE_LINK_CLASSES}
                    >
                        {t('NotFoundContent.ade95e')}
                    </Link>
                    <Link
                        href="/news"
                        prefetch={false}
                        className={CONTINUE_LINK_CLASSES}
                    >
                        {t('NotFoundContent.91dd85')}
                    </Link>
                </div>

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
        </main>
    );
}
