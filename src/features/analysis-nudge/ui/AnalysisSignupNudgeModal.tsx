'use client';

import { useEscapeKey } from '@/shared/hooks/useEscapeKey';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';
import { REASONING_FEATURE_LABEL } from '@/shared/lib/reasoningFeature';
import Link from 'next/link';
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
                className="bg-secondary-950/80 absolute inset-0 backdrop-blur-sm"
                onClick={onClose}
                aria-hidden="true"
            />

            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={TITLE_ID}
                tabIndex={-1}
                className="bg-secondary-900 ring-secondary-800 relative w-full max-w-sm rounded-2xl p-6 shadow-2xl ring-1 outline-none"
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
                        className="text-primary-400 h-8 w-8"
                        aria-hidden="true"
                    >
                        <path d="M12 2 2 7l10 5 10-5-10-5Z" />
                        <path d="m2 17 10 5 10-5" />
                        <path d="m2 12 10 5 10-5" />
                    </svg>
                    <h2
                        id={TITLE_ID}
                        className="text-secondary-50 font-semibold"
                    >
                        더 깊은 분석을 원하세요?
                    </h2>
                    <p className="text-secondary-300 text-sm leading-relaxed">
                        회원가입하면 &apos;{REASONING_FEATURE_LABEL}&apos;을
                        켜고 더 자세한 분석 리포트를 받을 수 있어요.
                    </p>
                </div>

                <div className="flex flex-col gap-2">
                    <Link
                        href="/signup"
                        onClick={onClose}
                        className="bg-primary-600 hover:bg-primary-500 focus-visible:ring-primary-500 flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium text-white transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    >
                        회원가입 하러 가기
                    </Link>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-secondary-400 hover:text-secondary-200 focus-visible:ring-primary-500 flex h-10 items-center justify-center rounded-lg px-4 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
}
