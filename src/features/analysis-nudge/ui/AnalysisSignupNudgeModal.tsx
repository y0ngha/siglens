'use client';

import { useTranslations } from 'next-intl';
import { REASONING_FEATURE_LABEL_KEY } from '@/features/reasoning-toggle/model/reasoningFeature';
import { BUTTON_GHOST, BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { ModalShell } from '@/shared/ui/ModalShell';
import type { SignupNudgeVariant } from '@/shared/lib/anonAnalysisCount';
import { LayersIcon, MailIcon } from '@/shared/ui/StrokeIcons';

interface AnalysisSignupNudgeModalProps {
    /**
     * 어떤 기능을 알릴지. `reasoning`은 상세 분석(추론 토글), `emailReport`는 보유 종목
     * 메일 리포트다. 잠금 토글 클릭은 늘 `reasoning`, 자동 넛지는 둘을 번갈아 쓴다.
     */
    variant: SignupNudgeVariant;
    onClose: () => void;
}

const TITLE_ID = 'analysis-signup-nudge-title';
const ACTION_SIZE = 'h-10 px-4 text-sm';

/**
 * Anonymous signup nudge modal (member-reasoning-toggle
 * spec Part B.3). Same shell as `PremiumModelGateModal` (focus-trap/escape/
 * backdrop close via `ModalShell`) but with its own copy — this modal is
 * purely informational (soft nudge), never blocking analysis.
 */
export function AnalysisSignupNudgeModal({
    variant,
    onClose,
}: AnalysisSignupNudgeModalProps) {
    const t = useTranslations('features.analysis-nudge');
    const tA11y = useTranslations('features.reasoning-toggle.a11y');

    return (
        <ModalShell
            titleId={TITLE_ID}
            onClose={onClose}
            focusPanel
            className="max-w-sm bg-secondary-900 p-6 shadow-2xl ring-1 ring-secondary-700"
        >
            <div className="mb-4 flex flex-col items-center gap-3 text-center">
                {variant === 'emailReport' ? (
                    <>
                        <MailIcon className="size-8 text-primary-400" />
                        <h2
                            id={TITLE_ID}
                            className="font-semibold text-secondary-50"
                        >
                            {t('AnalysisSignupNudgeModal.7e84b8')}
                        </h2>
                        <p className="text-sm leading-relaxed text-secondary-300">
                            {t('AnalysisSignupNudgeModal.ac43bc')}
                        </p>
                    </>
                ) : (
                    <>
                        <LayersIcon className="size-8 text-primary-400" />
                        <h2
                            id={TITLE_ID}
                            className="font-semibold text-secondary-50"
                        >
                            {t('AnalysisSignupNudgeModal.84ff73')}
                        </h2>
                        <p className="text-sm leading-relaxed text-secondary-300">
                            {/* The object-particle `을` assumes REASONING_FEATURE_LABEL_KEY
                                ends in a consonant (batchim) — true for '상세 분석'
                                (분석 ends in 석). Revisit the particle (을/를) if the
                                label ever changes to a vowel-final word. */}
                            {t('AnalysisSignupNudgeModal.486011', {
                                v0: tA11y(REASONING_FEATURE_LABEL_KEY),
                            })}
                        </p>
                    </>
                )}
            </div>

            <div className="flex flex-col gap-2">
                <Link
                    href="/signup"
                    onClick={onClose}
                    className={cn(BUTTON_PRIMARY, ACTION_SIZE)}
                >
                    {t('AnalysisSignupNudgeModal.2b8afd')}
                </Link>
                <button
                    type="button"
                    onClick={onClose}
                    className={cn(BUTTON_GHOST, ACTION_SIZE)}
                >
                    {t('AnalysisSignupNudgeModal.94b7db')}
                </button>
            </div>
        </ModalShell>
    );
}
