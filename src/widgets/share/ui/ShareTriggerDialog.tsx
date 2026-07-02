'use client';

import { useRef } from 'react';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';
import { useEscapeKey } from '@/shared/hooks/useEscapeKey';

interface ShareTriggerDialogProps {
    open: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

/**
 * Confirmation dialog shown when the user clicks Share but no analysis result
 * is ready yet. Explains that an analysis will be triggered first, then the
 * share sheet will open automatically.
 *
 * Mirrors the UserApiKeyRequiredModal pattern:
 * useFocusTrap (initial focus + Tab wrap + trigger restore) + useEscapeKey.
 * Default focus lands on the primary CTA so a single Enter confirms.
 */
export function ShareTriggerDialog({
    open,
    onConfirm,
    onCancel,
}: ShareTriggerDialogProps) {
    const dialogRef = useRef<HTMLDivElement>(null);

    useFocusTrap(dialogRef, open);
    useEscapeKey(onCancel, open);

    if (!open) return null;

    return (
        <div className="bg-secondary-950/80 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="share-trigger-dialog-title"
                tabIndex={-1}
                className="border-secondary-700 bg-secondary-800 w-full max-w-sm rounded-xl border shadow-2xl outline-none"
            >
                <div className="border-secondary-700 flex items-center justify-between border-b px-5 py-4">
                    <h2
                        id="share-trigger-dialog-title"
                        className="text-secondary-100 text-sm font-semibold"
                    >
                        공유하기 전에 분석을 준비할게요
                    </h2>
                    <button
                        type="button"
                        aria-label="닫기"
                        onClick={onCancel}
                        className="text-secondary-400 hover:text-secondary-200 focus-visible:ring-primary-500 -mr-1 rounded p-1 transition-colors focus-visible:ring-1 focus-visible:outline-none"
                    >
                        ✕
                    </button>
                </div>

                <div className="flex flex-col gap-4 px-5 py-4">
                    <p className="text-secondary-400 text-sm leading-relaxed">
                        이 종목의 AI 분석이 아직 없어요. 잠깐이면 준비돼요 —
                        끝나면 바로 공유 화면으로 이어드릴게요.
                    </p>

                    <div className="flex flex-col gap-2">
                        <button
                            type="button"
                            onClick={onConfirm}
                            className="bg-primary-600 hover:bg-primary-500 focus-visible:ring-primary-500 text-secondary-50 flex h-9 touch-manipulation items-center justify-center rounded-lg px-4 text-sm font-medium transition-colors focus-visible:ring-1 focus-visible:outline-none"
                        >
                            분석하고 공유하기
                        </button>

                        <button
                            type="button"
                            onClick={onCancel}
                            className="text-secondary-400 hover:text-secondary-200 focus-visible:ring-primary-500 border-secondary-700 flex h-9 touch-manipulation items-center justify-center rounded-lg border px-4 text-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
                        >
                            다음에
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
