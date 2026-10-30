'use client';

/**
 * 잠긴 티어용 단일 업셀 카드 — 회원 전용 상세 항목과 전체 스킬 수를 한 카드에 모아
 * 패널 하단에서 회원가입 CTA를 한 번만 노출한다(중복 제거).
 */
import { useTranslations } from 'next-intl';
import type { Ref } from 'react';
import { cn } from '@/shared/lib/cn';
import type { MeterState } from '@/shared/lib/funnel/funnelEvents';
import { trackFunnelEvent } from '@/shared/lib/funnel/trackFunnelEvent';
import { SURFACE_NESTED } from '@/shared/lib/surfaceStyles';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { useLockedCardCopy } from '../hooks/useLockedCardCopy';

interface LockedDetailCardProps {
    meter: MeterState | null;
    /** 잠긴 전체 스킬 수 — 업셀 문구에 쓴다. */
    skillCount: number;
    /** 미터 소진 카드일 때만 붙는 노출 측정 ref 콜백. */
    meterRef: Ref<HTMLDivElement>;
}

export function LockedDetailCard({
    meter,
    skillCount,
    meterRef,
}: LockedDetailCardProps) {
    const t = useTranslations('widgets.analysis');
    const { title, body } = useLockedCardCopy(meter, skillCount);
    const isMeterExhausted = meter === 'exhausted';
    return (
        <div
            ref={isMeterExhausted ? meterRef : undefined}
            className={cn(
                SURFACE_NESTED,
                'flex flex-col items-center gap-3 p-5 text-center'
            )}
        >
            <div className="flex flex-col gap-1.5">
                <p className="text-sm font-semibold text-balance text-secondary-100">
                    {title}
                </p>
                <p className="text-xs leading-relaxed text-balance text-secondary-300">
                    {body}
                </p>
                <p className="text-xs leading-relaxed text-secondary-400">
                    {t('AnalysisPanel.9971e1')}
                </p>
            </div>
            <Link
                href="/signup"
                // 가입 페이지로 가는 잠긴 요소 클릭 — 가입 퍼널의 게이트다.
                onClick={() =>
                    trackFunnelEvent(
                        'gate_clicked',
                        isMeterExhausted
                            ? { gate: 'locked_detail', meter: 'exhausted' }
                            : { gate: 'locked_detail' }
                    )
                }
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
            >
                {t('AnalysisPanel.ecb4cc')}
            </Link>
        </div>
    );
}
