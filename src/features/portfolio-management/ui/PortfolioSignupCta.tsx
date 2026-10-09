'use client';

import { useTranslations } from 'next-intl';
import { useLocalePath } from '@/shared/i18n/useLocalePath';
import { BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { trackFunnelEvent } from '@/shared/lib/funnel/trackFunnelEvent';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';

/** 비회원 `/portfolio`의 보유종목 자리. 가입 뒤 같은 로케일의 `/portfolio`로 돌아온다. */
export function PortfolioSignupCta() {
    const t = useTranslations('features.portfolio-management');
    const toLocalePath = useLocalePath();
    const next = toLocalePath('/portfolio');
    return (
        <section
            data-testid="portfolio-signup-cta"
            className={cn(
                SURFACE_CARD,
                'flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between'
            )}
        >
            <p className="text-sm leading-relaxed text-secondary-200">
                {t('PortfolioSignupCta.body')}
            </p>
            <Link
                href={`/signup?next=${encodeURIComponent(next)}`}
                prefetch={false}
                onClick={() =>
                    trackFunnelEvent('gate_clicked', { gate: 'portfolio_page' })
                }
                className={cn(BUTTON_PRIMARY, 'h-10 shrink-0 px-5 text-sm')}
            >
                {t('PortfolioSignupCta.cta')}
            </Link>
        </section>
    );
}
