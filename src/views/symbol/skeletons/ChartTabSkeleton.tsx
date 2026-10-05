'use client';

// ⚠️ `useTranslations`(서버 컴포넌트)는 요청 스코프의 로케일을 요구하는데,
// ISR 콜드 생성 시점에는 그게 없어 next-intl이 `headers()`로 폴백하고 정적 렌더가
// 중단된다 — `digest: 'DYNAMIC_SERVER_USAGE'`로 **종목 페이지 전체가 500**이었다
// (잘못된 심볼도 404 대신 500이 되어 soft 404가 재발). 클라이언트 컴포넌트는
// `NextIntlClientProvider`에서 로케일을 받으므로 요청 스코프가 필요 없다.
import { useTranslations } from 'next-intl';
// Layout (`/[symbol]/layout.tsx`) already renders the breadcrumb + tabs, so this
// skeleton only fills the page slot below the layout header while the chart page
// resolves its data. 내비게이션 중 `SymbolTabSkeleton`(클라 pending slot)이 그린다 —
// 예전엔 `[symbol]/loading.tsx`의 본문이었으나 그 파일은 서버 Suspense 경계를 만들어
// 직접 접속 HTML에 숨김 청크를 남기고 탭 가용성 `notFound()`를 200으로 새게 해 지웠다.
export function ChartTabSkeleton() {
    const t = useTranslations('app.symbol');
    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-secondary-900 text-secondary-200">
            <div className="relative flex min-h-0 flex-1 overflow-hidden">
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-secondary-900/60">
                    <span className="text-sm text-secondary-400">
                        {t('loading.486c8b')}
                    </span>
                </div>
            </div>
        </div>
    );
}
