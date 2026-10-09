'use client';

import { useTranslations } from 'next-intl';
import { BUTTON_GHOST, BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { useFunnelNudgeShown } from '@/shared/hooks/useFunnelNudgeShown';
import type { FunnelNudgeCta } from '@/shared/lib/funnel/funnelEvents';
import { trackFunnelEvent } from '@/shared/lib/funnel/trackFunnelEvent';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { ModalShell } from '@/shared/ui/ModalShell';
import { LockIcon } from '@/shared/ui/StrokeIcons';

interface AnalysisRateLimitSignupModalProps {
    /** 사용자 로케일로 포맷된 재시도 가능 시각. */
    retryAtLabel: string;
    onClose: () => void;
}

const TITLE_ID = 'analysis-rate-limit-signup-title';
const DESCRIPTION_ID = 'analysis-rate-limit-signup-description';
const ACTION_SIZE = 'h-10 px-4 text-sm';

/**
 * 비회원이 새 분석 생성 한도에 걸렸을 때 가입·로그인을 권하는 모달.
 *
 * 포커스 트랩·Esc·배경 클릭 닫기는 `ModalShell`이 맡는다. 안내형 모달이라 패널에
 * 포커스를 두고(`focusPanel`) 본문을 패널의 `aria-describedby`로 묶어, 스크린리더가 CTA보다
 * 사정을 먼저 읽게 한다. 캐시된 분석은 계속 보이므로 막는 모달이 아니다 — 닫기를
 * 항상 둔다.
 */
export function AnalysisRateLimitSignupModal({
    retryAtLabel,
    onClose,
}: AnalysisRateLimitSignupModalProps) {
    const t = useTranslations('features.analysis-rate-limit');

    useFunnelNudgeShown({ kind: 'rate_limit' });

    const closeAfterCta = (cta: FunnelNudgeCta) => (): void => {
        trackFunnelEvent('nudge_clicked', { kind: 'rate_limit', cta });
        onClose();
    };

    return (
        <ModalShell
            titleId={TITLE_ID}
            descriptionId={DESCRIPTION_ID}
            onClose={onClose}
            focusPanel
            className="max-w-sm bg-secondary-900 p-6 shadow-2xl ring-1 ring-secondary-700"
        >
            <div className="mb-4 flex flex-col items-center gap-3 text-center">
                <LockIcon className="size-8 text-primary-400" />
                <h2 id={TITLE_ID} className="font-semibold text-secondary-50">
                    {t('title')}
                </h2>
                <p
                    id={DESCRIPTION_ID}
                    className="text-sm leading-relaxed text-secondary-300"
                >
                    {t('description', { v0: retryAtLabel })}
                </p>
            </div>

            <div className="flex flex-col gap-2">
                <Link
                    href="/signup"
                    onClick={closeAfterCta('signup')}
                    className={cn(BUTTON_PRIMARY, ACTION_SIZE)}
                >
                    {t('signup')}
                </Link>
                <Link
                    href="/login"
                    onClick={closeAfterCta('login')}
                    className={cn(BUTTON_GHOST, ACTION_SIZE)}
                >
                    {t('login')}
                </Link>
                <button
                    type="button"
                    onClick={onClose}
                    className={cn(BUTTON_GHOST, ACTION_SIZE)}
                >
                    {t('close')}
                </button>
            </div>
        </ModalShell>
    );
}
