'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';

interface PremiumModelGateModalProps {
    mode: 'auth' | 'byok';
    providerLabel?: string;
    symbol?: string;
    onClose: () => void;
}

export function PremiumModelGateModal({
    mode,
    providerLabel,
    symbol,
    onClose,
}: PremiumModelGateModalProps) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const closedRef = useRef(false);

    const isAuth = mode === 'auth';
    const iconColorClass = isAuth ? 'text-amber-400' : 'text-emerald-400';
    const title = isAuth ? '프리미엄 모델 사용 안내' : 'API 키 등록 필요';
    const body = isAuth
        ? '프리미엄 모델을 사용하려면 로그인이 필요합니다.'
        : `${providerLabel ?? ''} API 키를 등록하면 이 모델을 사용할 수 있습니다.`;

    const safeClose = () => {
        if (closedRef.current) return;
        closedRef.current = true;
        onClose();
    };

    const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
        if (e.target === dialogRef.current) {
            safeClose();
        }
    };

    useEffect(() => {
        const dialog = dialogRef.current;
        if (dialog === null) return;
        dialog.showModal();
        return () => {
            dialog.close();
        };
    }, []);

    return (
        <dialog
            ref={dialogRef}
            onClick={handleBackdropClick}
            onClose={safeClose}
            className="bg-transparent backdrop:bg-secondary-950/80 backdrop:backdrop-blur-sm"
        >
            <div className="bg-secondary-900 ring-secondary-800 w-full max-w-sm rounded-2xl p-6 shadow-2xl ring-1">
                <div className="mb-4 flex flex-col items-center gap-3 text-center">
                    {/* Lock icon — inline SVG avoids lucide-react dependency */}
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
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <h2 className="text-secondary-50 font-semibold">{title}</h2>
                    <p className="text-secondary-300 text-sm">{body}</p>
                </div>

                <div className="flex flex-col gap-2">
                    {isAuth ? (
                        <>
                            <Link
                                href={
                                    symbol !== undefined
                                        ? `/login?next=/${symbol}`
                                        : '/login'
                                }
                                className="bg-primary-600 hover:bg-primary-500 focus-visible:ring-primary-500 rounded-lg px-4 py-2 text-center text-sm font-medium text-white transition-colors focus-visible:ring-2 focus-visible:outline-none"
                            >
                                로그인
                            </Link>
                            <Link
                                href="/signup"
                                className="bg-secondary-700 hover:bg-secondary-600 text-secondary-200 focus-visible:ring-primary-500 rounded-lg px-4 py-2 text-center text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
                            >
                                회원가입
                            </Link>
                        </>
                    ) : (
                        <Link
                            href="/account"
                            className="bg-primary-600 hover:bg-primary-500 focus-visible:ring-primary-500 rounded-lg px-4 py-2 text-center text-sm font-medium text-white transition-colors focus-visible:ring-2 focus-visible:outline-none"
                        >
                            API 키 등록하러 가기
                        </Link>
                    )}
                    <button
                        type="button"
                        onClick={safeClose}
                        className="text-secondary-400 hover:text-secondary-200 focus-visible:ring-primary-500 rounded-lg px-4 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </dialog>
    );
}
