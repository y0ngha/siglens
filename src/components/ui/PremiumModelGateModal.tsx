'use client';

import { useEscapeKey } from '@/shared/hooks/useEscapeKey';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';
import type { GateMode } from '@/entities/api-key';
import { cn } from '@/shared/lib/cn';
import Link from 'next/link';
import { useEffect, useRef } from 'react';

interface PremiumModelGateModalProps {
    mode: GateMode;
    providerLabel?: string;
    onClose: () => void;
}

const TITLE_ID = 'premium-model-gate-title';

export function PremiumModelGateModal({
    mode,
    providerLabel,
    onClose,
}: PremiumModelGateModalProps) {
    const panelRef = useRef<HTMLDivElement>(null);

    useFocusTrap(panelRef, true);
    useEscapeKey(onClose, true);

    useEffect(() => {
        panelRef.current?.focus();
    }, []);

    const isAuth = mode === 'auth';
    const iconColorClass = isAuth ? 'text-ui-warning' : 'text-ui-success';
    const title = isAuth ? '프리미엄 모델 사용 안내' : 'API 키 등록 필요';
    const body = isAuth
        ? '회원가입 후 API 키를 등록하면 이 모델을 사용할 수 있어요.'
        : `${providerLabel ?? ''} API 키를 등록하면 이 모델을 사용할 수 있어요.`;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            aria-modal="true"
        >
            {/* backdrop */}
            <div
                className="bg-secondary-950/80 absolute inset-0 backdrop-blur-sm"
                onClick={onClose}
                aria-hidden="true"
            />

            <div
                ref={panelRef}
                role="dialog"
                aria-labelledby={TITLE_ID}
                tabIndex={-1}
                className="bg-secondary-900 ring-secondary-800 relative w-full max-w-sm rounded-2xl p-6 shadow-2xl ring-1 outline-none"
            >
                <div className="mb-4 flex flex-col items-center gap-3 text-center">
                    {/* inline SVG avoids lucide-react dependency */}
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={cn('h-8 w-8', iconColorClass)}
                        aria-hidden="true"
                    >
                        <rect
                            x="3"
                            y="11"
                            width="18"
                            height="11"
                            rx="2"
                            ry="2"
                        />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <h2
                        id={TITLE_ID}
                        className="text-secondary-50 font-semibold"
                    >
                        {title}
                    </h2>
                    <p className="text-secondary-300 text-sm leading-relaxed">
                        {body}
                    </p>
                </div>

                <div className="flex flex-col gap-2">
                    {isAuth ? (
                        <Link
                            href="/signup"
                            onClick={onClose}
                            className="bg-primary-600 hover:bg-primary-500 focus-visible:ring-primary-500 flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium text-white transition-colors focus-visible:ring-2 focus-visible:outline-none"
                        >
                            회원가입 하러 가기
                        </Link>
                    ) : (
                        <Link
                            href="/account"
                            onClick={onClose}
                            className="bg-primary-600 hover:bg-primary-500 focus-visible:ring-primary-500 flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium text-white transition-colors focus-visible:ring-2 focus-visible:outline-none"
                        >
                            등록하러 가기
                        </Link>
                    )}
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
