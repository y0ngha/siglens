'use client';

import { useTranslations } from 'next-intl';
import { useUrlSearchParam } from '@/shared/hooks/useUrlSearchParam';
import { useLocalePath } from '@/shared/i18n/useLocalePath';
import { BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { LINK_ACCENT } from '@/shared/lib/linkStyles';
import { trackFunnelEvent } from '@/shared/lib/funnel/trackFunnelEvent';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';

/**
 * 비회원 `/portfolio`의 보유종목 자리. 가입·로그인 뒤 같은 로케일의 `/portfolio`로 돌아온다.
 * `?symbol=`(`PositionCta`·옛 `/onboarding?symbol=` 리다이렉트가 싣고 온 종목)은 `next`에 그대로
 * 실어 보낸다 — 안 그러면 클릭 의도가 가입/로그인 홉에서 사라진다.
 * 서버 스냅샷은 null이라 정적 HTML은 심볼 없는 링크이고, 하이드레이션 직후 심볼이 붙는다.
 * 로그인 링크는 세션이 만료된
 * 기존 회원이 가입 화면으로 잘못 가지 않게 하는 출구이기도 하다.
 */
export function PortfolioSignupCta() {
    const t = useTranslations('features.portfolio-management');
    const toLocalePath = useLocalePath();
    const symbol =
        useUrlSearchParam('symbol')?.trim().toUpperCase() || undefined;
    const next =
        toLocalePath('/portfolio') +
        (symbol ? `?symbol=${encodeURIComponent(symbol)}` : '');
    const encodedNext = encodeURIComponent(next);
    return (
        <section
            data-testid="portfolio-signup-cta"
            aria-labelledby="portfolio-signup-heading"
            className={cn(SURFACE_CARD, 'p-6 sm:p-8')}
        >
            <h2 id="portfolio-signup-heading" className={HEADING_SECTION}>
                {t('PortfolioSignupCta.title')}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-secondary-300">
                {t('PortfolioSignupCta.body')}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
                <Link
                    href={`/signup?next=${encodedNext}`}
                    prefetch={false}
                    onClick={() =>
                        trackFunnelEvent('gate_clicked', {
                            gate: 'portfolio_page',
                        })
                    }
                    className={cn(BUTTON_PRIMARY, 'h-11 px-5 text-sm')}
                >
                    {t('PortfolioSignupCta.cta')}
                </Link>
                <Link
                    href={`/login?next=${encodedNext}`}
                    prefetch={false}
                    className="inline-flex min-h-11 items-center rounded text-sm font-medium text-primary-400 transition-colors hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                >
                    {t('PortfolioSignupCta.login')}
                </Link>
            </div>
            {/* 가입 전에도 쓸 수 있는 쪽으로 출구를 하나 둔다 — 관심종목은 비회원도 기기에 담는다. */}
            <p className="mt-6 border-t border-secondary-700 pt-4 text-sm text-secondary-400">
                {t('PortfolioSignupCta.watchlistHint')}{' '}
                <Link
                    href="/watchlist"
                    prefetch={false}
                    className={cn(
                        LINK_ACCENT,
                        'inline-flex min-h-11 items-center rounded'
                    )}
                >
                    {t('PortfolioSignupCta.watchlistLink')}
                </Link>
            </p>
        </section>
    );
}
