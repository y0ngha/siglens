'use client';

import { useTranslations } from 'next-intl';
import { useFunnelNudgeShown } from '@/shared/hooks/useFunnelNudgeShown';
import type { GateMode } from '@/shared/lib/types';
import { BUTTON_GHOST, BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { trackFunnelEvent } from '@/shared/lib/funnel/trackFunnelEvent';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { ModalShell } from '@/shared/ui/ModalShell';
import { LockIcon } from '@/shared/ui/StrokeIcons';

interface PremiumModelGateModalProps {
    mode: GateMode;
    providerLabel?: string;
    onClose: () => void;
}

const TITLE_ID = 'premium-model-gate-title';
const ACTION_SIZE = 'h-10 px-4 text-sm';

export function PremiumModelGateModal({
    mode,
    providerLabel,
    onClose,
}: PremiumModelGateModalProps) {
    const t = useTranslations('features.premium-gate');
    const tMisc = useTranslations('shared.ui.misc');

    const isAuth = mode === 'auth';

    useFunnelNudgeShown({ kind: 'model_gate' });

    // auth는 가입 페이지로, byok는 계정 설정(API 키 등록)으로 보낸다.
    const handleCtaClick = (): void => {
        trackFunnelEvent('nudge_clicked', {
            kind: 'model_gate',
            cta: isAuth ? 'signup' : 'settings',
        });
        onClose();
    };
    const iconColorClass = isAuth
        ? 'text-ui-warning-text'
        : 'text-ui-success-text';
    const title = isAuth
        ? t('PremiumModelGateModal.2d4880')
        : t('PremiumModelGateModal.2f2f6d');
    const body = isAuth
        ? t('PremiumModelGateModal.671fa2')
        : tMisc('byokUnlock', { v0: providerLabel ?? '' });

    return (
        <ModalShell
            titleId={TITLE_ID}
            onClose={onClose}
            focusPanel
            className="max-w-sm bg-secondary-900 p-6 shadow-2xl ring-1 ring-secondary-700"
        >
            <div className="mb-4 flex flex-col items-center gap-3 text-center">
                <LockIcon className={cn('size-8', iconColorClass)} />
                <h2 id={TITLE_ID} className="font-semibold text-secondary-50">
                    {title}
                </h2>
                <p className="text-sm leading-relaxed text-secondary-300">
                    {body}
                </p>
            </div>

            <div className="flex flex-col gap-2">
                {isAuth ? (
                    <Link
                        href="/signup"
                        onClick={handleCtaClick}
                        className={cn(BUTTON_PRIMARY, ACTION_SIZE)}
                    >
                        {t('PremiumModelGateModal.2b8afd')}
                    </Link>
                ) : (
                    <Link
                        href="/account"
                        onClick={handleCtaClick}
                        className={cn(BUTTON_PRIMARY, ACTION_SIZE)}
                    >
                        {t('PremiumModelGateModal.e91c23')}
                    </Link>
                )}
                <button
                    type="button"
                    onClick={onClose}
                    className={cn(BUTTON_GHOST, ACTION_SIZE)}
                >
                    {t('PremiumModelGateModal.94b7db')}
                </button>
            </div>
        </ModalShell>
    );
}
