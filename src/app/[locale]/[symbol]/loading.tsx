'use client';

// ⚠️ `useTranslations`(서버 컴포넌트)는 요청 스코프의 로케일을 요구하는데,
// ISR 콜드 생성 시점에는 그게 없어 next-intl이 `headers()`로 폴백하고 정적 렌더가
// 중단된다 — `digest: 'DYNAMIC_SERVER_USAGE'`로 **종목 페이지 전체가 500**이었다
// (잘못된 심볼도 404 대신 500이 되어 soft 404가 재발). 클라이언트 컴포넌트는
// `NextIntlClientProvider`에서 로케일을 받으므로 요청 스코프가 필요 없다.
import { useTranslations } from 'next-intl';
// Layout (`/[symbol]/layout.tsx`) already renders the breadcrumb + tabs, so this
// fallback only fills the page slot below the layout header while the chart page
// resolves its data. The chart page renders its own TimeframeSelector once mounted.
export default function SymbolLoading() {
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
