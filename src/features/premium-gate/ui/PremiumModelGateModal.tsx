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
import type { GatedModelAccess } from '../lib/resolveGateMode';

interface PremiumModelGateModalProps {
    mode: GateMode;
    providerLabel?: string;
    /**
     * 고른 모델의 등급. `auth` 모드에서 member 모델은 가입만으로 열리므로 API 키 안내를
     * 빼고, byok 모델(또는 생략)이면 가입 후 키 등록까지 안내한다.
     */
    access?: GatedModelAccess;
    onClose: () => void;
}

/** 모드별 아이콘 색·제목·본문·CTA. */
interface GateContent {
    iconColorClass: string;
    title: string;
    body: string;
    ctaHref: string;
    ctaLabel: string;
}

const TITLE_ID = 'premium-model-gate-title';
const ACTION_SIZE = 'h-10 px-4 text-sm';

/**
 * 잠긴 모델을 골랐을 때 뜨는 게이트 모달. 비회원에게는 가입(`auth`), 키 없는 회원에게는
 * API 키 등록(`byok`)을 안내한다. 열림 여부는 호출부가 정하고, 닫기는 `onClose`로 알린다.
 */
export function PremiumModelGateModal({
    mode,
    providerLabel,
    access = 'byok',
    onClose,
}: PremiumModelGateModalProps) {
    const t = useTranslations('features.premium-gate');
    const tMisc = useTranslations('shared.ui.misc');

    const isAuth = mode === 'auth';

    // byok 모드는 로그인한 회원에게 API 키 등록을 안내하는 모달이다 — 가입 유도가 아니라
    // 비회원 퍼널에 넣지 않는다(노출·클릭 모두).
    useFunnelNudgeShown({ kind: 'model_gate' }, isAuth);

    const handleCtaClick = (): void => {
        if (isAuth) {
            trackFunnelEvent('nudge_clicked', {
                kind: 'model_gate',
                cta: 'signup',
            });
        }
        onClose();
    };

    // auth는 가입 페이지로, byok는 계정 설정(API 키 등록)으로 보낸다. `Record`라 모드가
    // 늘면 여기서 컴파일 오류로 드러난다.
    const content: Record<GateMode, GateContent> = {
        auth: {
            iconColorClass: 'text-ui-warning-text',
            title: t('PremiumModelGateModal.2d4880'),
            body:
                access === 'member'
                    ? t('PremiumModelGateModal.41b8c4')
                    : t('PremiumModelGateModal.671fa2'),
            ctaHref: '/signup',
            ctaLabel: t('PremiumModelGateModal.2b8afd'),
        },
        byok: {
            iconColorClass: 'text-ui-success-text',
            title: t('PremiumModelGateModal.2f2f6d'),
            body: tMisc('byokUnlock', { v0: providerLabel ?? '' }),
            ctaHref: '/account',
            ctaLabel: t('PremiumModelGateModal.e91c23'),
        },
    };
    const { iconColorClass, title, body, ctaHref, ctaLabel } = content[mode];

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
                <Link
                    href={ctaHref}
                    onClick={handleCtaClick}
                    className={cn(BUTTON_PRIMARY, ACTION_SIZE)}
                >
                    {ctaLabel}
                </Link>
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
