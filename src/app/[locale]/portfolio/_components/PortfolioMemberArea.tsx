import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { PortfolioSignupCta } from '@/features/portfolio-management/ui/PortfolioSignupCta';
import type { Locale } from '@/shared/i18n/locales';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { PositionHoldingCard } from '@/widgets/portfolio-position/ui/PositionHoldingCard';
import { loadPortfolioHoldings } from '../_lib/loadPortfolioHoldings';
import { PortfolioManager } from './PortfolioManager';
import {
    PortfolioEmptyState,
    PortfolioErrorState,
    PortfolioManagerSkeleton,
} from './PortfolioStates';

/** 요청 로케일 — 회원 영역 문구를 같은 로케일로 번역하는 데 쓴다. */
export interface PortfolioMemberAreaProps {
    readonly locale: Locale;
}

/**
 * `/portfolio`의 세션 의존 영역. 비회원도 이 페이지에 들어온다(프록시 가드·`redirect` 없음) —
 * 비회원에게는 가입 CTA 카드를 그리고 보유 DB를 읽지 않는다. 회원에게는 보유종목 관리 폼과 위치
 * 카드 그리드를 그린다. `getCurrentUser()`(쿠키)를 한 번만 읽으므로 페이지의 Suspense 안에서
 * 그린다.
 *
 * 서버 비용은 보유 DB 읽기 1회로 묶인다 — 종목별 가격 범위는 여기서 가져오지 않는다. 각
 * `PositionHoldingCard`가 뷰포트에 들어올 때 자기 종목의 봉을 클라이언트에서 지연 로드하므로
 * 이 동적 페이지가 방문마다 N-symbol FMP 팬아웃을 일으키지 않는다.
 */
export async function PortfolioMemberArea({
    locale,
}: PortfolioMemberAreaProps) {
    const user = await getCurrentUser();
    if (!user) return <PortfolioSignupCta />;

    const [t, holdings] = await Promise.all([
        getTranslations({ locale, namespace: 'app.portfolio' }),
        loadPortfolioHoldings(user.id),
    ]);
    if (holdings === null) return <PortfolioErrorState />;

    return (
        <>
            <section
                aria-label={t('page.06c7de')}
                className={cn(SURFACE_CARD, 'space-y-4 p-6')}
            >
                <Suspense fallback={<PortfolioManagerSkeleton />}>
                    <PortfolioManager />
                </Suspense>
            </section>
            <section
                aria-labelledby="portfolio-positions-heading"
                className="space-y-4"
            >
                <h2
                    id="portfolio-positions-heading"
                    className={HEADING_SECTION}
                >
                    {t('page.55ca69')}
                </h2>
                {holdings.length === 0 ? (
                    <PortfolioEmptyState />
                ) : (
                    <div
                        data-testid="portfolio-holding-grid"
                        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                    >
                        {holdings.map(holding => (
                            <PositionHoldingCard
                                key={holding.symbol}
                                holding={holding}
                            />
                        ))}
                    </div>
                )}
            </section>
        </>
    );
}
