'use client';

/**
 * 비회원 하루 무료 공개 미터가 `revealed`일 때 매매 전략 위에 띄우는 안내 띠와 가입 CTA.
 */
import { useTranslations } from 'next-intl';
import type { Ref } from 'react';
import { trackFunnelEvent } from '@/shared/lib/funnel/trackFunnelEvent';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { resolveMeterDailySymbols } from '../utils/meterDailySymbols';

interface MeterRevealedNoticeProps {
    /** 노출 측정(`useFunnelMeterShown`) ref 콜백. */
    meterRef: Ref<HTMLDivElement>;
}

export function MeterRevealedNotice({ meterRef }: MeterRevealedNoticeProps) {
    const tPanel = useTranslations('widgets.analysis.panel');
    return (
        <div
            ref={meterRef}
            className="flex flex-col gap-1 rounded-lg border border-primary-500/30 bg-primary-500/10 px-4 py-3"
        >
            <p className="text-sm font-semibold text-secondary-100">
                {tPanel('meter.revealedTitle')}
            </p>
            <p className="text-xs leading-relaxed text-secondary-300">
                {tPanel('meter.revealedBody', {
                    count: resolveMeterDailySymbols(),
                })}
            </p>
            <Link
                href="/signup"
                onClick={() =>
                    trackFunnelEvent('meter_clicked', { state: 'revealed' })
                }
                className="w-fit text-xs font-semibold text-primary-300 underline underline-offset-2 hover:text-primary-200 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
            >
                {tPanel('meter.revealedCta')}
            </Link>
        </div>
    );
}
