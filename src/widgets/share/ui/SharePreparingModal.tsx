'use client';

import { useRef } from 'react';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';
import { useEscapeKey } from '@/shared/hooks/useEscapeKey';
import { SpinnerIcon } from './icons';

interface SharePreparingModalProps {
    open: boolean;
    phase: 'pending' | 'error';
    onClose: () => void;
    onRetry: () => void;
}

/**
 * Modal shown while an analysis is being prepared for sharing.
 *
 * - pending: full-screen-centered spinner + aria-live status text + sub-hint.
 * - error: error message + retry + close buttons.
 *
 * Uses useFocusTrap + useEscapeKey (same pattern as UserApiKeyRequiredModal).
 * aria-busy="true" during pending so screen readers announce the live region.
 */
export function SharePreparingModal({
    open,
    phase,
    onClose,
    onRetry,
}: SharePreparingModalProps) {
    const dialogRef = useRef<HTMLDivElement>(null);

    useFocusTrap(dialogRef, open);
    useEscapeKey(onClose, open);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-secondary-950/80 p-4 backdrop-blur-sm">
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="share-preparing-modal-title"
                aria-busy={phase === 'pending' ? 'true' : undefined}
                tabIndex={-1}
                className="w-full max-w-sm rounded-lg border border-secondary-700 bg-secondary-800 shadow-2xl outline-none"
            >
                <div className="flex items-center justify-between border-b border-secondary-700 px-5 py-4">
                    <h2
                        id="share-preparing-modal-title"
                        className="text-sm font-semibold text-secondary-100"
                    >
                        {phase === 'pending' ? '분석 준비 중' : '분석 실패'}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="닫기"
                        className="touch-manipulation rounded p-1 text-secondary-500 transition-colors hover:text-secondary-300 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
                    >
                        ✕
                    </button>
                </div>

                <div className="flex flex-col items-center gap-4 px-5 py-6">
                    {phase === 'pending' ? (
                        <>
                            <SpinnerIcon className="h-8 w-8 text-primary-500" />
                            <div
                                aria-live="polite"
                                className="flex flex-col items-center gap-1 text-center"
                            >
                                <p className="text-sm text-secondary-200">
                                    AI가 분석 결과를 준비하고 있어요&hellip;
                                </p>
                                <p className="text-xs text-secondary-500">
                                    보통 10–30초면 끝나요
                                </p>
                            </div>
                        </>
                    ) : (
                        <>
                            <p className="text-center text-sm text-secondary-300">
                                분석을 끝내지 못했어요. 다시 시도할까요?
                            </p>
                            <div className="flex w-full flex-col gap-2">
                                <button
                                    type="button"
                                    onClick={onRetry}
                                    className="flex h-9 touch-manipulation items-center justify-center rounded-lg bg-primary-600 px-4 text-sm font-medium text-secondary-50 transition-colors hover:bg-primary-500 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
                                >
                                    다시 시도
                                </button>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex h-9 touch-manipulation items-center justify-center rounded-lg border border-border-control px-4 text-sm text-secondary-400 transition-colors hover:text-secondary-200 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
                                >
                                    닫기
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
