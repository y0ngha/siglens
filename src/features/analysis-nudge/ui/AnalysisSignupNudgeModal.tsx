'use client';

import { useTranslations } from 'next-intl';
import { useEscapeKey } from '@/shared/hooks/useEscapeKey';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';
import { REASONING_FEATURE_LABEL } from '@/features/reasoning-toggle';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { useEffect, useRef } from 'react';

interface AnalysisSignupNudgeModalProps {
    onClose: () => void;
}

const TITLE_ID = 'analysis-signup-nudge-title';

/**
 * Anonymous 3-distinct-symbol signup nudge modal (member-reasoning-toggle
 * spec Part B.3). Reuses `PremiumModelGateModal`'s auth-mode dialog a11y
 * pattern (focus-trap/escape/backdrop close) but with its own copy — this
 * modal is purely informational (soft nudge), never blocking analysis.
 */
export function AnalysisSignupNudgeModal({
    onClose,
}: AnalysisSignupNudgeModalProps) {
    const t = useTranslations('features.analysis-nudge');
    const panelRef = useRef<HTMLDivElement>(null);

    useFocusTrap(panelRef, true);
    useEscapeKey(onClose, true);

    useEffect(() => {
        panelRef.current?.focus();
    }, []);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* backdrop */}
            <div
                className="absolute inset-0 bg-secondary-950/80 backdrop-blur-sm"
                onClick={onClose}
                aria-hidden="true"
            />

            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={TITLE_ID}
                tabIndex={-1}
                className="relative w-full max-w-sm rounded-2xl bg-secondary-900 p-6 shadow-2xl ring-1 ring-secondary-800 outline-none"
            >
                <div className="mb-4 flex flex-col items-center gap-3 text-center">
                    {/* inline SVG avoids lucide-react dependency, mirrors PremiumModelGateModal */}
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-8 w-8 text-primary-400"
                        aria-hidden="true"
                    >
                        <path d="M12 2 2 7l10 5 10-5-10-5Z" />
                        <path d="m2 17 10 5 10-5" />
                        <path d="m2 12 10 5 10-5" />
                    </svg>
                    <h2
                        id={TITLE_ID}
                        className="font-semibold text-secondary-50"
                    >
                        {t('AnalysisSignupNudgeModal.84ff73')}
                    </h2>
                    <p className="text-sm leading-relaxed text-secondary-300">
                        {/* The object-particle `을` assumes REASONING_FEATURE_LABEL
                            ends in a consonant (batchim) — true for '상세 분석'
                            (분석 ends in 석). Revisit the particle (을/를) if the
                            label ever changes to a vowel-final word. */}
                        {t('AnalysisSignupNudgeModal.486011', {
                            v0: REASONING_FEATURE_LABEL,
                        })}
                    </p>
                </div>

                <div className="flex flex-col gap-2">
                    <Link
                        href="/signup"
                        onClick={onClose}
                        className="flex h-10 items-center justify-center rounded-lg bg-primary-600 px-4 text-sm font-medium text-white transition-colors hover:bg-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                    >
                        {t('AnalysisSignupNudgeModal.2b8afd')}
                    </Link>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-10 items-center justify-center rounded-lg px-4 text-sm text-secondary-400 transition-colors hover:text-secondary-200 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                    >
                        {t('AnalysisSignupNudgeModal.94b7db')}
                    </button>
                </div>
            </div>
        </div>
    );
}
